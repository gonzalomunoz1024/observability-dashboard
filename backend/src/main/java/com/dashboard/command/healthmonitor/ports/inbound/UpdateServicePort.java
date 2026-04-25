package com.dashboard.command.healthmonitor.ports.inbound;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.command.UpdateServiceCommand;
import reactor.core.publisher.Mono;

public interface UpdateServicePort {

    Mono<MonitoredService> execute(UpdateServiceCommand command);
}
