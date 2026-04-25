package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.domain.command.InjectEventCommand;
import com.dashboard.command.synthetic.ports.outbound.EventPublisherPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DefaultInjectEventUseCase implements InjectEventUseCase {

    private final EventPublisherPort eventPublisherPort;

    @Override
    public Mono<SyntheticEvent> execute(InjectEventCommand command) {
        String correlationId = UUID.randomUUID().toString();
        Instant timestamp = Instant.now();

        SyntheticEvent event = SyntheticEvent.builder()
                .correlationId(correlationId)
                .eventType(command.getEventType())
                .timestamp(timestamp)
                .source("synthetic-dashboard")
                .payload(command.getPayload())
                .build();

        return eventPublisherPort.publishEvent(command.getTopic(), event)
                .thenReturn(event);
    }
}
