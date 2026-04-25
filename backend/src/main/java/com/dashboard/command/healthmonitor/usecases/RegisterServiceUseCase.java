package com.dashboard.command.healthmonitor.usecases;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.command.RegisterServiceCommand;
import reactor.core.publisher.Mono;

public interface RegisterServiceUseCase {

    Mono<MonitoredService> execute(RegisterServiceCommand command);
}
