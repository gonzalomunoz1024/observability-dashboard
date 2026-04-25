package com.dashboard.command.health.usecases;

import com.dashboard.command.health.domain.command.CheckHealthCommand;
import com.dashboard.command.health.domain.HealthStatus;
import reactor.core.publisher.Mono;

public interface CheckHealthUseCase {
    Mono<HealthStatus> execute(CheckHealthCommand command);
}
