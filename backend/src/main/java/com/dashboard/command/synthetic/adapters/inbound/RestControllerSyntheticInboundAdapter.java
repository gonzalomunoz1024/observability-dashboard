package com.dashboard.command.synthetic.adapters.inbound;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.domain.command.InjectEventCommand;
import com.dashboard.command.synthetic.domain.command.RestInjectCommand;
import com.dashboard.command.synthetic.domain.command.TraceEventCommand;
import com.dashboard.command.synthetic.dto.inbound.InjectAndTraceRequestDto;
import com.dashboard.command.synthetic.dto.inbound.InjectRequestDto;
import com.dashboard.command.synthetic.dto.inbound.ProbeRequestDto;
import com.dashboard.command.synthetic.dto.inbound.RestInjectAndCheckRequestDto;
import com.dashboard.command.synthetic.dto.inbound.TraceRequestDto;
import com.dashboard.command.synthetic.dto.outbound.InjectResponseDto;
import com.dashboard.command.synthetic.dto.outbound.ProbeResponseDto;
import com.dashboard.command.synthetic.dto.outbound.RestCheckResponseDto;
import com.dashboard.command.synthetic.dto.outbound.TraceResponseDto;
import com.dashboard.command.synthetic.ports.outbound.HttpProbePort;
import com.dashboard.command.synthetic.usecases.InjectEventUseCase;
import com.dashboard.command.synthetic.usecases.RestInjectAndProbeUseCase;
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
    private final RestInjectAndProbeUseCase restInjectAndProbeUseCase;
    private final HttpProbePort httpProbePort;

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

    @PostMapping("/rest/probe")
    public Mono<ResponseEntity<?>> probe(@RequestBody ProbeRequestDto request) {
        if (request.getUrl() == null || request.getUrl().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "URL is required")));
        }

        long start = System.currentTimeMillis();
        String method = request.getMethod() == null || request.getMethod().isBlank()
                ? "GET" : request.getMethod();

        return httpProbePort.execute(request.getUrl(), method, request.getBody(), request.getHeaders())
                .<ResponseEntity<?>>map(response -> ResponseEntity.ok(ProbeResponseDto.builder()
                        .statusCode(response.getStatusCode())
                        .body(response.getBody())
                        .elapsedTime(System.currentTimeMillis() - start)
                        .build()))
                .onErrorResume(e -> Mono.just(ResponseEntity.ok(ProbeResponseDto.builder()
                        .statusCode(-1)
                        .error(e.getMessage())
                        .elapsedTime(System.currentTimeMillis() - start)
                        .build())));
    }

    @PostMapping("/rest/inject-and-check")
    public Mono<ResponseEntity<?>> restInjectAndCheck(@RequestBody RestInjectAndCheckRequestDto request) {
        if (request.getStartUrl() == null || request.getStartUrl().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Start URL is required")));
        }
        if (request.getProbeUrl() == null || request.getProbeUrl().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Probe URL is required")));
        }
        if (request.getStatusJsonPath() == null || request.getStatusJsonPath().isBlank()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Status JSON path is required (e.g., \"$.status\")")));
        }
        if (request.getExpectedStatusValue() == null || request.getExpectedStatusValue().isBlank()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Expected status value is required (e.g., \"COMPLETED\")")));
        }
        if (request.getProbeUrl().contains("{{id}}")
                && (request.getIdJsonPath() == null || request.getIdJsonPath().isBlank())) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "ID JSON path is required when probe URL contains {{id}}")));
        }

        RestInjectCommand command = RestInjectCommand.builder()
                .startUrl(request.getStartUrl())
                .method(request.getMethod())
                .body(request.getBody())
                .headers(request.getHeaders())
                .probeUrl(request.getProbeUrl())
                .idJsonPath(request.getIdJsonPath())
                .statusJsonPath(request.getStatusJsonPath())
                .expectedStatusValue(request.getExpectedStatusValue())
                .timeout(request.getTimeout() > 0 ? request.getTimeout() : 30000)
                .pollInterval(request.getPollInterval() > 0 ? request.getPollInterval() : 1000)
                .build();

        return restInjectAndProbeUseCase.execute(command)
                .map(result -> ResponseEntity.ok(RestCheckResponseDto.builder()
                        .status(result.getStatus())
                        .extractedId(result.getExtractedId())
                        .startStatusCode(result.getStartStatusCode())
                        .startResponseSnippet(result.getStartResponseSnippet())
                        .attempts(result.getAttempts())
                        .lastStatusCode(result.getLastStatusCode())
                        .lastResponseSnippet(result.getLastResponseSnippet())
                        .matchedValue(result.getMatchedValue())
                        .error(result.getError())
                        .elapsedTime(result.getElapsedTime())
                        .build()));
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
