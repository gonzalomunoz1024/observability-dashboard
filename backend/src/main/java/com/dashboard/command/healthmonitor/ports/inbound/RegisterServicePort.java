package com.dashboard.command.healthmonitor.ports.inbound;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.command.RegisterServiceCommand;
import reactor.core.publisher.Mono;

public interface RegisterServicePort {

    Mono<MonitoredService> execute(RegisterServiceCommand command);
}
