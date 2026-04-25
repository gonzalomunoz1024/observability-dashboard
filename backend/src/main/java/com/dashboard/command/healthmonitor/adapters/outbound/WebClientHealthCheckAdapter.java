package com.dashboard.command.healthmonitor.adapters.outbound;

import com.dashboard.command.health.domain.HealthStatus;
import com.dashboard.command.health.ports.outbound.HttpClientPort;
import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.ports.outbound.HealthCheckExecutorPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebClientHealthCheckAdapter implements HealthCheckExecutorPort {

    private final HttpClientPort httpClientPort;

    @Override
    public Mono<HealthStatus> checkHealth(MonitoredService service) {
        log.debug("Executing health check for service: {} at {}", service.getName(), service.getUrl());

        return httpClientPort.checkEndpoint(
                service.getUrl(),
                service.getMethod(),
                service.getTimeout(),
                service.getExpectedStatus()
        ).doOnSuccess(status -> log.debug("Health check result for {}: {}", service.getName(), status.getStatus()))
         .doOnError(error -> log.warn("Health check failed for {}: {}", service.getName(), error.getMessage()));
    }
}
