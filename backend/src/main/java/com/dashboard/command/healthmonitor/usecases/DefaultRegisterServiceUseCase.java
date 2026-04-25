package com.dashboard.command.healthmonitor.usecases;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.ServiceHealthState;
import com.dashboard.command.healthmonitor.domain.command.RegisterServiceCommand;
import com.dashboard.command.healthmonitor.ports.outbound.MonitoredServiceRepositoryPort;
import com.dashboard.command.healthmonitor.ports.outbound.ServiceHealthStateRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultRegisterServiceUseCase implements RegisterServiceUseCase {

    private final MonitoredServiceRepositoryPort serviceRepository;
    private final ServiceHealthStateRepositoryPort stateRepository;

    @Override
    public Mono<MonitoredService> execute(RegisterServiceCommand command) {
        log.info("Registering new monitored service: {}", command.getName());

        MonitoredService service = MonitoredService.builder()
                .name(command.getName())
                .url(command.getUrl())
                .method(command.getMethod() != null ? command.getMethod() : "GET")
                .timeout(command.getTimeout() > 0 ? command.getTimeout() : 5000)
                .expectedStatus(command.getExpectedStatus() > 0 ? command.getExpectedStatus() : 200)
                .checkIntervalSeconds(command.getCheckIntervalSeconds() > 0 ? command.getCheckIntervalSeconds() : 60)
                .enabled(true)
                .alertRecipients(String.join(",", command.getAlertRecipients()))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        return serviceRepository.save(service)
                .flatMap(savedService -> {
                    ServiceHealthState initialState = ServiceHealthState.builder()
                            .serviceId(savedService.getId())
                            .consecutiveFailures(0)
                            .alertSent(false)
                            .currentStatus("unknown")
                            .build();

                    return stateRepository.save(initialState)
                            .doOnSuccess(state -> log.info("Created health state for service: {}", savedService.getName()))
                            .thenReturn(savedService);
                })
                .doOnSuccess(s -> log.info("Successfully registered service: {} with id: {}", s.getName(), s.getId()));
    }
}
