package com.dashboard.command.health.ports.inbound;

import com.dashboard.command.health.domain.command.CheckHealthCommand;
import com.dashboard.command.health.domain.HealthStatus;
import reactor.core.publisher.Mono;

public interface CheckHealthPort {
    Mono<HealthStatus> execute(CheckHealthCommand command);
}
