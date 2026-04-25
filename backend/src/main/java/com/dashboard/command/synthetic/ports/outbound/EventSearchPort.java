package com.dashboard.command.synthetic.ports.outbound;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import reactor.core.publisher.Flux;

public interface EventSearchPort {
    Flux<SyntheticEvent> searchByCorrelationId(String correlationId, String index);
}
