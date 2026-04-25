package com.dashboard.command.health.ports.outbound;

import com.dashboard.command.health.domain.HealthStatus;
import reactor.core.publisher.Mono;

public interface HttpClientPort {
    Mono<HealthStatus> checkEndpoint(String url, String method, int timeout, int expectedStatus);
}
