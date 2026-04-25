package com.dashboard.command.synthetic.adapters.outbound;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.ports.outbound.EventPublisherPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Slf4j
@Component
@RequiredArgsConstructor
public class SpringCloudStreamEventPublisherAdapter implements EventPublisherPort {

    private final StreamBridge streamBridge;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<String> publishEvent(String topic, SyntheticEvent event) {
        return Mono.fromCallable(() -> {
            try {
                String payload = objectMapper.writeValueAsString(event);

                Message<String> message = MessageBuilder
                        .withPayload(payload)
                        .setHeader(KafkaHeaders.KEY, event.getCorrelationId())
                        .setHeader("correlationId", event.getCorrelationId())
                        .setHeader("eventType", event.getEventType())
                        .setHeader("source", event.getSource())
                        .build();

                boolean sent = streamBridge.send(topic, message);

                if (sent) {
                    log.info("Published event to topic {}: correlationId={}", topic, event.getCorrelationId());
                    return event.getCorrelationId();
                } else {
                    throw new RuntimeException("Failed to publish event to topic: " + topic);
                }
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Failed to serialize event", e);
            }
        });
    }
}
