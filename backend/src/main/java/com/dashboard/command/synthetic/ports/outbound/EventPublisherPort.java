package com.dashboard.command.synthetic.ports.outbound;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import reactor.core.publisher.Mono;

public interface EventPublisherPort {
    Mono<String> publishEvent(String topic, SyntheticEvent event);
}
