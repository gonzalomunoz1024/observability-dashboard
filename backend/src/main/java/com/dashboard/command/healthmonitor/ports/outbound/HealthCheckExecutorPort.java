package com.dashboard.command.healthmonitor.ports.outbound;

import com.dashboard.command.health.domain.HealthStatus;
import com.dashboard.command.healthmonitor.domain.MonitoredService;
import reactor.core.publisher.Mono;

public interface HealthCheckExecutorPort {

    Mono<HealthStatus> checkHealth(MonitoredService service);
}
