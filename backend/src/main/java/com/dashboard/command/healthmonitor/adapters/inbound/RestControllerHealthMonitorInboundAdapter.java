package com.dashboard.command.healthmonitor.adapters.inbound;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.ServiceHealthState;
import com.dashboard.command.healthmonitor.domain.command.RegisterServiceCommand;
import com.dashboard.command.healthmonitor.domain.command.UpdateServiceCommand;
import com.dashboard.command.healthmonitor.domain.dto.inbound.RegisterServiceRequestDto;
import com.dashboard.command.healthmonitor.domain.dto.inbound.TestEmailRequestDto;
import com.dashboard.command.healthmonitor.domain.dto.inbound.UpdateServiceRequestDto;
import com.dashboard.command.healthmonitor.domain.dto.outbound.HealthCheckResultDto;
import com.dashboard.command.healthmonitor.domain.dto.outbound.MonitoredServiceResponseDto;
import com.dashboard.command.healthmonitor.domain.dto.outbound.MonitoredServiceWithStatusDto;
import com.dashboard.command.healthmonitor.ports.outbound.EmailNotificationPort;
import com.dashboard.command.healthmonitor.ports.outbound.MonitoredServiceRepositoryPort;
import com.dashboard.command.healthmonitor.ports.outbound.ServiceHealthStateRepositoryPort;
import com.dashboard.command.healthmonitor.usecases.ExecuteHealthChecksUseCase;
import com.dashboard.command.healthmonitor.usecases.RegisterServiceUseCase;
import com.dashboard.command.healthmonitor.usecases.UpdateServiceUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/monitored-services")
@RequiredArgsConstructor
public class RestControllerHealthMonitorInboundAdapter {

    private final RegisterServiceUseCase registerServiceUseCase;
    private final UpdateServiceUseCase updateServiceUseCase;
    private final ExecuteHealthChecksUseCase executeHealthChecksUseCase;
    private final MonitoredServiceRepositoryPort serviceRepository;
    private final ServiceHealthStateRepositoryPort stateRepository;
    private final EmailNotificationPort emailNotificationPort;

    @PostMapping
    public Mono<ResponseEntity<MonitoredServiceResponseDto>> registerService(
            @Valid @RequestBody RegisterServiceRequestDto request) {
        log.info("Received request to register service: {}", request.getName());

        RegisterServiceCommand command = RegisterServiceCommand.builder()
                .name(request.getName())
                .url(request.getUrl())
                .method(request.getMethod())
                .timeout(request.getTimeout())
                .expectedStatus(request.getExpectedStatus())
                .checkIntervalSeconds(request.getCheckIntervalSeconds())
                .alertRecipients(request.getAlertRecipients())
                .build();

        return registerServiceUseCase.execute(command)
                .map(service -> ResponseEntity.status(HttpStatus.CREATED)
                        .body(mapToResponseDto(service)));
    }

    @GetMapping
    public Flux<MonitoredServiceWithStatusDto> getAllServices() {
        return serviceRepository.findAll()
                .flatMap(service -> stateRepository.findByServiceId(service.getId())
                        .map(state -> mapToServiceWithStatus(service, state))
                        .defaultIfEmpty(mapToServiceWithStatus(service, null)));
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<MonitoredServiceWithStatusDto>> getService(@PathVariable Long id) {
        return serviceRepository.findById(id)
                .flatMap(service -> stateRepository.findByServiceId(id)
                        .map(state -> mapToServiceWithStatus(service, state))
                        .defaultIfEmpty(mapToServiceWithStatus(service, null)))
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public Mono<ResponseEntity<MonitoredServiceResponseDto>> updateService(
            @PathVariable Long id,
            @Valid @RequestBody UpdateServiceRequestDto request) {
        log.info("Received request to update service: {}", id);

        UpdateServiceCommand command = UpdateServiceCommand.builder()
                .id(id)
                .name(request.getName())
                .url(request.getUrl())
                .method(request.getMethod())
                .timeout(request.getTimeout())
                .expectedStatus(request.getExpectedStatus())
                .checkIntervalSeconds(request.getCheckIntervalSeconds())
                .enabled(request.isEnabled())
                .alertRecipients(request.getAlertRecipients())
                .build();

        return updateServiceUseCase.execute(command)
                .map(service -> ResponseEntity.ok(mapToResponseDto(service)))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public Mono<ResponseEntity<Void>> deleteService(@PathVariable Long id) {
        log.info("Received request to delete service: {}", id);

        return stateRepository.deleteByServiceId(id)
                .then(serviceRepository.deleteById(id))
                .then(Mono.just(ResponseEntity.noContent().<Void>build()));
    }

    @PostMapping("/{id}/enable")
    public Mono<ResponseEntity<MonitoredServiceResponseDto>> enableService(@PathVariable Long id) {
        return toggleServiceEnabled(id, true);
    }

    @PostMapping("/{id}/disable")
    public Mono<ResponseEntity<MonitoredServiceResponseDto>> disableService(@PathVariable Long id) {
        return toggleServiceEnabled(id, false);
    }

    @PostMapping("/check-now")
    public Mono<ResponseEntity<HealthCheckResultDto>> triggerManualCheck() {
        log.info("Received request to trigger manual health check");

        return executeHealthChecksUseCase.executeAllChecks()
                .map(count -> ResponseEntity.ok(HealthCheckResultDto.builder()
                        .status("completed")
                        .servicesChecked(count)
                        .build()));
    }

    @PostMapping("/{id}/reset-alert")
    public Mono<ResponseEntity<Void>> resetAlertState(@PathVariable Long id) {
        log.info("Received request to reset alert state for service: {}", id);

        return stateRepository.findByServiceId(id)
                .flatMap(state -> {
                    state.setAlertSent(false);
                    state.setAlertSentTime(null);
                    return stateRepository.save(state);
                })
                .then(Mono.just(ResponseEntity.ok().<Void>build()))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @PostMapping("/test-email")
    public Mono<ResponseEntity<java.util.Map<String, Object>>> sendTestEmail(@Valid @RequestBody TestEmailRequestDto request) {
        log.info("Received request to send test email for service: {} to {}",
                request.getServiceName(), request.getRecipients());

        return emailNotificationPort.sendTestEmail(request.getRecipients(), request.getServiceName())
                .then(Mono.just(ResponseEntity.ok().body(
                        java.util.Map.<String, Object>of("success", true, "message", "Test email sent successfully"))))
                .onErrorResume(e -> Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(java.util.Map.<String, Object>of("success", false, "message", e.getMessage()))));
    }

    private Mono<ResponseEntity<MonitoredServiceResponseDto>> toggleServiceEnabled(Long id, boolean enabled) {
        return serviceRepository.findById(id)
                .flatMap(service -> {
                    service.setEnabled(enabled);
                    service.setUpdatedAt(Instant.now());
                    return serviceRepository.update(service);
                })
                .map(service -> ResponseEntity.ok(mapToResponseDto(service)))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    private MonitoredServiceResponseDto mapToResponseDto(MonitoredService service) {
        return MonitoredServiceResponseDto.builder()
                .id(service.getId())
                .name(service.getName())
                .url(service.getUrl())
                .method(service.getMethod())
                .timeout(service.getTimeout())
                .expectedStatus(service.getExpectedStatus())
                .checkIntervalSeconds(service.getCheckIntervalSeconds())
                .enabled(service.isEnabled())
                .alertRecipients(parseRecipients(service.getAlertRecipients()))
                .createdAt(service.getCreatedAt())
                .updatedAt(service.getUpdatedAt())
                .build();
    }

    private MonitoredServiceWithStatusDto mapToServiceWithStatus(MonitoredService service, ServiceHealthState state) {
        return MonitoredServiceWithStatusDto.builder()
                .id(service.getId())
                .name(service.getName())
                .url(service.getUrl())
                .method(service.getMethod())
                .timeout(service.getTimeout())
                .expectedStatus(service.getExpectedStatus())
                .checkIntervalSeconds(service.getCheckIntervalSeconds())
                .enabled(service.isEnabled())
                .alertRecipients(parseRecipients(service.getAlertRecipients()))
                .createdAt(service.getCreatedAt())
                .updatedAt(service.getUpdatedAt())
                .currentStatus(state != null ? state.getCurrentStatus() : "unknown")
                .consecutiveFailures(state != null ? state.getConsecutiveFailures() : 0)
                .alertSent(state != null && state.isAlertSent())
                .lastCheckTime(state != null ? state.getLastCheckTime() : null)
                .lastSuccessTime(state != null ? state.getLastSuccessTime() : null)
                .lastFailureTime(state != null ? state.getLastFailureTime() : null)
                .lastError(state != null ? state.getLastError() : null)
                .build();
    }

    private List<String> parseRecipients(String recipients) {
        if (recipients == null || recipients.isBlank()) {
            return List.of();
        }
        return Arrays.stream(recipients.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
