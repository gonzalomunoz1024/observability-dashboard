package com.dashboard.command.healthmonitor.ports.inbound;

import com.dashboard.command.healthmonitor.domain.event.ServiceDownEvent;
import com.dashboard.command.healthmonitor.domain.event.ServiceRecoveredEvent;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface ExecuteHealthChecksPort {

    Mono<Integer> executeAllChecks();
}
