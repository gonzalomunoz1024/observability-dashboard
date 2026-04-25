package com.dashboard.command.healthmonitor.usecases;

import com.dashboard.command.health.domain.HealthStatus;
import com.dashboard.command.healthmonitor.domain.AlertNotification;
import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.ServiceHealthState;
import com.dashboard.command.healthmonitor.domain.event.ServiceDownEvent;
import com.dashboard.command.healthmonitor.domain.event.ServiceRecoveredEvent;
import com.dashboard.command.healthmonitor.ports.outbound.EmailNotificationPort;
import com.dashboard.command.healthmonitor.ports.outbound.HealthCheckExecutorPort;
import com.dashboard.command.healthmonitor.ports.outbound.MonitoredServiceRepositoryPort;
import com.dashboard.command.healthmonitor.ports.outbound.ServiceHealthStateRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultExecuteHealthChecksUseCase implements ExecuteHealthChecksUseCase {

    private final MonitoredServiceRepositoryPort serviceRepository;
    private final ServiceHealthStateRepositoryPort stateRepository;
    private final HealthCheckExecutorPort healthCheckExecutor;
    private final EmailNotificationPort emailNotificationPort;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${health-monitor.alerts.consecutive-failures-threshold:3}")
    private int failureThreshold;

    @Override
    public Mono<Integer> executeAllChecks() {
        log.debug("Starting health checks for all enabled services");
        AtomicInteger count = new AtomicInteger(0);

        return serviceRepository.findAllEnabled()
                .flatMap(service -> checkServiceAndProcess(service)
                        .doOnSuccess(v -> count.incrementAndGet()))
                .then(Mono.fromCallable(count::get))
                .doOnSuccess(c -> log.debug("Completed health checks for {} services", c));
    }

    private Mono<Void> checkServiceAndProcess(MonitoredService service) {
        log.debug("Checking service: {}", service.getName());

        return healthCheckExecutor.checkHealth(service)
                .flatMap(healthStatus -> processHealthResult(service, healthStatus))
                .onErrorResume(error -> {
                    log.error("Error checking service {}: {}", service.getName(), error.getMessage());
                    return handleFailure(service, error.getMessage());
                });
    }

    private Mono<Void> processHealthResult(MonitoredService service, HealthStatus status) {
        if ("healthy".equals(status.getStatus())) {
            return handleSuccess(service, status);
        } else {
            return handleFailure(service, status.getError());
        }
    }

    private Mono<Void> handleSuccess(MonitoredService service, HealthStatus status) {
        return stateRepository.findByServiceId(service.getId())
                .switchIfEmpty(createInitialState(service.getId()))
                .flatMap(state -> {
                    boolean wasDown = state.isAlertSent();
                    Instant previousFailureTime = state.getLastFailureTime();

                    // Reset state on success
                    state.setConsecutiveFailures(0);
                    state.setCurrentStatus("healthy");
                    state.setLastCheckTime(Instant.now());
                    state.setLastSuccessTime(Instant.now());
                    state.setLastError(null);

                    Mono<Void> notificationMono = Mono.empty();

                    // If we sent an alert before, send recovery notification
                    if (wasDown) {
                        state.setAlertSent(false);
                        state.setAlertSentTime(null);

                        Long downDuration = previousFailureTime != null
                                ? Duration.between(previousFailureTime, Instant.now()).getSeconds()
                                : null;

                        // Publish domain event
                        ServiceRecoveredEvent event = ServiceRecoveredEvent.builder()
                                .serviceId(service.getId())
                                .serviceName(service.getName())
                                .serviceUrl(service.getUrl())
                                .downSince(previousFailureTime)
                                .downDurationSeconds(downDuration)
                                .timestamp(Instant.now())
                                .build();
                        eventPublisher.publishEvent(event);

                        AlertNotification recovery = AlertNotification.builder()
                                .alertType(AlertNotification.AlertType.SERVICE_RECOVERED)
                                .serviceName(service.getName())
                                .serviceUrl(service.getUrl())
                                .timestamp(Instant.now())
                                .recipients(parseRecipients(service.getAlertRecipients()))
                                .downSince(previousFailureTime)
                                .downDurationSeconds(downDuration)
                                .build();

                        notificationMono = emailNotificationPort.sendRecoveryNotification(recovery)
                                .doOnSuccess(v -> log.info("Recovery notification sent for service: {}", service.getName()))
                                .onErrorResume(e -> {
                                    log.error("Failed to send recovery notification for {}: {}", service.getName(), e.getMessage());
                                    return Mono.empty();
                                });
                    }

                    return notificationMono
                            .then(stateRepository.save(state))
                            .doOnSuccess(s -> log.debug("Service {} is healthy", service.getName()))
                            .then();
                });
    }

    private Mono<Void> handleFailure(MonitoredService service, String errorMessage) {
        return stateRepository.findByServiceId(service.getId())
                .switchIfEmpty(createInitialState(service.getId()))
                .flatMap(state -> {
                    int newFailureCount = state.getConsecutiveFailures() + 1;
                    state.setConsecutiveFailures(newFailureCount);
                    state.setCurrentStatus("unhealthy");
                    state.setLastCheckTime(Instant.now());
                    state.setLastFailureTime(Instant.now());
                    state.setLastError(errorMessage);

                    log.warn("Service {} failed check #{}: {}", service.getName(), newFailureCount, errorMessage);

                    Mono<Void> notificationMono = Mono.empty();

                    // Send alert only if threshold reached AND alert not already sent
                    if (newFailureCount >= failureThreshold && !state.isAlertSent()) {
                        state.setAlertSent(true);
                        state.setAlertSentTime(Instant.now());

                        // Publish domain event
                        ServiceDownEvent event = ServiceDownEvent.builder()
                                .serviceId(service.getId())
                                .serviceName(service.getName())
                                .serviceUrl(service.getUrl())
                                .consecutiveFailures(newFailureCount)
                                .errorMessage(errorMessage)
                                .timestamp(Instant.now())
                                .build();
                        eventPublisher.publishEvent(event);

                        AlertNotification alert = AlertNotification.builder()
                                .alertType(AlertNotification.AlertType.SERVICE_DOWN)
                                .serviceName(service.getName())
                                .serviceUrl(service.getUrl())
                                .consecutiveFailures(newFailureCount)
                                .errorMessage(errorMessage)
                                .timestamp(Instant.now())
                                .recipients(parseRecipients(service.getAlertRecipients()))
                                .build();

                        notificationMono = emailNotificationPort.sendAlert(alert)
                                .doOnSuccess(v -> log.info("Alert sent for service: {} after {} failures",
                                        service.getName(), newFailureCount))
                                .onErrorResume(e -> {
                                    log.error("Failed to send alert for {}: {}", service.getName(), e.getMessage());
                                    return Mono.empty();
                                });
                    }

                    return notificationMono
                            .then(stateRepository.save(state))
                            .then();
                });
    }

    private Mono<ServiceHealthState> createInitialState(Long serviceId) {
        ServiceHealthState state = ServiceHealthState.builder()
                .serviceId(serviceId)
                .consecutiveFailures(0)
                .alertSent(false)
                .currentStatus("unknown")
                .build();
        return stateRepository.save(state);
    }

    private List<String> parseRecipients(String recipients) {
        if (recipients == null || recipients.isBlank()) {
            return List.of();
        }
        return Arrays.asList(recipients.split(","));
    }
}
