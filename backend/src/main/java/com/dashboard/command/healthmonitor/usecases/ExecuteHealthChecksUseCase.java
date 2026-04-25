package com.dashboard.command.healthmonitor.usecases;

import reactor.core.publisher.Mono;

public interface ExecuteHealthChecksUseCase {

    Mono<Integer> executeAllChecks();
}
