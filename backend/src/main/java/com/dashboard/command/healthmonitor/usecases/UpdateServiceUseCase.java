package com.dashboard.command.healthmonitor.usecases;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.command.UpdateServiceCommand;
import reactor.core.publisher.Mono;

public interface UpdateServiceUseCase {

    Mono<MonitoredService> execute(UpdateServiceCommand command);
}
