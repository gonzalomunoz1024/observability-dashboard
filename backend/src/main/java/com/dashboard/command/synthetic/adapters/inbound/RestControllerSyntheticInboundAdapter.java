package com.dashboard.command.synthetic.adapters.inbound;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.domain.command.InjectEventCommand;
import com.dashboard.command.synthetic.domain.command.TraceEventCommand;
import com.dashboard.command.synthetic.dto.inbound.InjectAndTraceRequestDto;
import com.dashboard.command.synthetic.dto.inbound.InjectRequestDto;
import com.dashboard.command.synthetic.dto.inbound.TraceRequestDto;
import com.dashboard.command.synthetic.dto.outbound.InjectResponseDto;
import com.dashboard.command.synthetic.dto.outbound.TraceResponseDto;
import com.dashboard.command.synthetic.usecases.InjectEventUseCase;
import com.dashboard.command.synthetic.usecases.TraceEventUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/synthetic")
@RequiredArgsConstructor
public class RestControllerSyntheticInboundAdapter {

    private final InjectEventUseCase injectEventUseCase;
    private final TraceEventUseCase traceEventUseCase;

    @PostMapping("/inject")
    public Mono<ResponseEntity<?>> inject(@RequestBody InjectRequestDto request) {
        if (request.getTopic() == null || request.getTopic().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Topic is required")));
        }
        if (request.getEventType() == null || request.getEventType().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Event type is required")));
        }

        InjectEventCommand command = InjectEventCommand.builder()
                .topic(request.getTopic())
                .eventType(request.getEventType())
                .payload(request.getPayload())
                .build();

        return injectEventUseCase.execute(command)
                .map(event -> ResponseEntity.ok(InjectResponseDto.builder()
                        .success(true)
                        .correlationId(event.getCorrelationId())
                        .timestamp(event.getTimestamp())
                        .topic(request.getTopic())
                        .eventType(event.getEventType())
                        .build()));
    }

    @PostMapping("/trace")
    public Mono<ResponseEntity<?>> trace(@RequestBody TraceRequestDto request) {
        if (request.getCorrelationId() == null || request.getCorrelationId().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Correlation ID is required")));
        }
        if (request.getExpectedFlow() == null || request.getExpectedFlow().isBlank()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Expected flow is required (e.g., \"A -> B -> C\")")));
        }

        TraceEventCommand command = TraceEventCommand.builder()
                .correlationId(request.getCorrelationId())
                .expectedFlow(request.getExpectedFlow())
                .index(request.getIndex())
                .timeout(request.getTimeout() > 0 ? request.getTimeout() : 30000)
                .build();

        return traceEventUseCase.execute(command)
                .map(result -> ResponseEntity.ok(mapToTraceResponse(result)));
    }

    @PostMapping("/inject-and-trace")
    public Mono<ResponseEntity<?>> injectAndTrace(@RequestBody InjectAndTraceRequestDto request) {
        if (request.getTopic() == null || request.getTopic().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Topic is required")));
        }
        if (request.getEventType() == null || request.getEventType().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Event type is required")));
        }
        if (request.getExpectedFlow() == null || request.getExpectedFlow().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Expected flow is required")));
        }

        InjectEventCommand injectCommand = InjectEventCommand.builder()
                .topic(request.getTopic())
                .eventType(request.getEventType())
                .payload(request.getPayload())
                .build();

        return injectEventUseCase.execute(injectCommand)
                .flatMap(event -> {
                    TraceEventCommand traceCommand = TraceEventCommand.builder()
                            .correlationId(event.getCorrelationId())
                            .expectedFlow(request.getExpectedFlow())
                            .index(request.getIndex())
                            .timeout(request.getTimeout() > 0 ? request.getTimeout() : 30000)
                            .build();

                    return traceEventUseCase.execute(traceCommand)
                            .map(traceResult -> {
                                Map<String, Object> response = new HashMap<>();
                                response.put("injection", InjectResponseDto.builder()
                                        .success(true)
                                        .correlationId(event.getCorrelationId())
                                        .timestamp(event.getTimestamp())
                                        .topic(request.getTopic())
                                        .eventType(event.getEventType())
                                        .build());
                                response.put("trace", mapToTraceResponse(traceResult));
                                return ResponseEntity.ok(response);
                            });
                });
    }

    private TraceResponseDto mapToTraceResponse(com.dashboard.command.synthetic.domain.TraceResult result) {
        return TraceResponseDto.builder()
                .correlationId(result.getCorrelationId())
                .expectedFlow(result.getExpectedFlow())
                .foundEvents(result.getFoundEvents().stream()
                        .map(this::eventToMap)
                        .collect(Collectors.toList()))
                .completedSteps(result.getCompletedSteps())
                .missingSteps(result.getMissingSteps())
                .status(result.getStatus())
                .elapsedTime(result.getElapsedTime())
                .build();
    }

    private Map<String, Object> eventToMap(SyntheticEvent event) {
        Map<String, Object> map = new HashMap<>();
        map.put("correlationId", event.getCorrelationId());
        map.put("eventType", event.getEventType());
        map.put("timestamp", event.getTimestamp());
        map.put("source", event.getSource());
        map.put("payload", event.getPayload());
        return map;
    }
}
