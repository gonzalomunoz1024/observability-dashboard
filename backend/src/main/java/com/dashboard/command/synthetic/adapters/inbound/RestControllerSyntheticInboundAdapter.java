package com.dashboard.command.synthetic.adapters.inbound;

import com.dashboard.command.synthetic.domain.HttpProbeResponse;
import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.domain.SyntheticRun;
import com.dashboard.command.synthetic.domain.SyntheticTransaction;
import com.jayway.jsonpath.JsonPath;
import com.dashboard.command.synthetic.domain.command.InjectEventCommand;
import com.dashboard.command.synthetic.domain.command.RestInjectCommand;
import com.dashboard.command.synthetic.domain.command.TraceEventCommand;
import com.dashboard.command.synthetic.dto.inbound.InjectAndTraceRequestDto;
import com.dashboard.command.synthetic.dto.inbound.InjectRequestDto;
import com.dashboard.command.synthetic.dto.inbound.ParseSpecRequestDto;
import com.dashboard.command.synthetic.dto.inbound.ProbeOnceRequestDto;
import com.dashboard.command.synthetic.dto.inbound.ProbeRequestDto;
import com.dashboard.command.synthetic.dto.inbound.RestInjectAndCheckRequestDto;
import com.dashboard.command.synthetic.dto.inbound.SyntheticTransactionDto;
import com.dashboard.command.synthetic.dto.inbound.TraceRequestDto;
import com.dashboard.command.synthetic.dto.outbound.InjectResponseDto;
import com.dashboard.command.synthetic.dto.outbound.ProbeOnceResponseDto;
import com.dashboard.command.synthetic.dto.outbound.ProbeResponseDto;
import com.dashboard.command.synthetic.dto.outbound.RestCheckResponseDto;
import com.dashboard.command.synthetic.dto.outbound.SyntheticRunResponseDto;
import com.dashboard.command.synthetic.dto.outbound.SyntheticTransactionResponseDto;
import com.dashboard.command.synthetic.dto.outbound.TraceResponseDto;
import com.dashboard.command.synthetic.ports.outbound.HttpProbePort;
import com.dashboard.command.synthetic.ports.outbound.SyntheticRunRepositoryPort;
import com.dashboard.command.synthetic.ports.outbound.SyntheticTransactionRepositoryPort;
import com.dashboard.command.synthetic.usecases.DynamicFieldsResolver;
import com.dashboard.command.synthetic.usecases.InjectEventUseCase;
import com.dashboard.command.synthetic.usecases.ParseSpecUseCase;
import com.dashboard.command.synthetic.usecases.RestInjectAndProbeUseCase;
import com.dashboard.command.synthetic.usecases.RunSyntheticTransactionUseCase;
import com.dashboard.command.synthetic.usecases.TemplateResolver;
import com.dashboard.command.synthetic.usecases.TraceEventUseCase;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
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
    private final SyntheticTransactionRepositoryPort transactionRepository;
    private final SyntheticRunRepositoryPort runRepository;
    private final RunSyntheticTransactionUseCase runUseCase;
    private final ObjectMapper objectMapper;
    private final TemplateResolver templateResolver;
    private final DynamicFieldsResolver dynamicFieldsResolver;
    private final ParseSpecUseCase parseSpecUseCase;

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

        String resolvedUrl = templateResolver.render(request.getUrl());
        String resolvedBody = dynamicFieldsResolver.apply(
                templateResolver.render(request.getBody()), request.getDynamicFields());
        Map<String, String> resolvedHeaders = renderHeaderMap(request.getHeaders());

        return httpProbePort.execute(resolvedUrl, method, resolvedBody, resolvedHeaders)
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

    @PostMapping("/rest/probe-once")
    public Mono<ResponseEntity<?>> probeOnce(@RequestBody ProbeOnceRequestDto request) {
        if (request.getStartUrl() == null || request.getStartUrl().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Start URL is required")));
        }
        if (request.getProbeUrl() == null || request.getProbeUrl().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Probe URL is required")));
        }

        long startTime = System.currentTimeMillis();
        String startMethod = request.getMethod() == null || request.getMethod().isBlank()
                ? "POST" : request.getMethod();

        String resolvedStartUrl = templateResolver.render(request.getStartUrl());
        String resolvedBody = dynamicFieldsResolver.apply(
                templateResolver.render(request.getBody()), request.getDynamicFields());
        Map<String, String> resolvedHeaders = renderHeaderMap(request.getHeaders());

        return httpProbePort.execute(resolvedStartUrl, startMethod, resolvedBody, resolvedHeaders)
                .onErrorResume(e -> Mono.just(HttpProbeResponse.builder()
                        .statusCode(-1).body("Request failed: " + e.getMessage()).build()))
                .flatMap(startResp -> {
                    long startElapsed = System.currentTimeMillis() - startTime;
                    ProbeResponseDto startDto = ProbeResponseDto.builder()
                            .statusCode(startResp.getStatusCode())
                            .body(startResp.getBody())
                            .elapsedTime(startElapsed)
                            .build();

                    if (startResp.getStatusCode() < 200 || startResp.getStatusCode() >= 300) {
                        return Mono.just(ResponseEntity.ok(ProbeOnceResponseDto.builder()
                                .start(startDto)
                                .error("Start endpoint returned status " + startResp.getStatusCode())
                                .build()));
                    }

                    String probeUrl = templateResolver.render(request.getProbeUrl());
                    String extractedId = null;
                    if (probeUrl.contains("{{id}}")) {
                        if (request.getIdJsonPath() == null || request.getIdJsonPath().isBlank()) {
                            return Mono.just(ResponseEntity.ok(ProbeOnceResponseDto.builder()
                                    .start(startDto)
                                    .error("Probe URL uses {{id}} but no idJsonPath was provided")
                                    .build()));
                        }
                        try {
                            Object idValue = JsonPath.read(startResp.getBody(), request.getIdJsonPath());
                            extractedId = String.valueOf(idValue);
                            probeUrl = probeUrl.replace("{{id}}", extractedId);
                        } catch (Exception e) {
                            return Mono.just(ResponseEntity.ok(ProbeOnceResponseDto.builder()
                                    .start(startDto)
                                    .error("Failed to extract id with path '" + request.getIdJsonPath() + "': " + e.getMessage())
                                    .build()));
                        }
                    }

                    String resolvedProbeUrl = probeUrl;
                    String finalExtractedId = extractedId;
                    long probeStart = System.currentTimeMillis();
                    return httpProbePort.execute(resolvedProbeUrl, "GET", null, resolvedHeaders)
                            .onErrorResume(e -> Mono.just(HttpProbeResponse.builder()
                                    .statusCode(-1).body("Request failed: " + e.getMessage()).build()))
                            .<ResponseEntity<?>>map(probeResp -> ResponseEntity.ok(ProbeOnceResponseDto.builder()
                                    .start(startDto)
                                    .extractedId(finalExtractedId)
                                    .resolvedProbeUrl(resolvedProbeUrl)
                                    .probe(ProbeResponseDto.builder()
                                            .statusCode(probeResp.getStatusCode())
                                            .body(probeResp.getBody())
                                            .elapsedTime(System.currentTimeMillis() - probeStart)
                                            .build())
                                    .build()));
                });
    }

    @PostMapping("/swagger/parse")
    public Mono<ResponseEntity<?>> parseSwagger(@RequestBody ParseSpecRequestDto request) {
        return parseSpecUseCase.parse(request.getSource(), request.getValue())
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.badRequest()
                        .body(Map.of("error", truncateError(e.getMessage())))));
    }

    private String truncateError(String message) {
        if (message == null) return "Unknown error";
        // Strip raw HTML bodies the swagger parser echoes back on failure.
        String cleaned = message.replaceAll("(?is)<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        return cleaned.length() > 300 ? cleaned.substring(0, 300) + "…" : cleaned;
    }

    @PostMapping("/template/preview")
    public Mono<ResponseEntity<?>> previewTemplate(@RequestBody JsonNode payload) {
        JsonNode textNode = payload != null ? payload.get("text") : null;
        if (textNode == null || textNode.isNull()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Missing 'text' field")));
        }
        String text = textNode.asText();
        String afterTemplates = templateResolver.render(text);

        List<com.dashboard.command.synthetic.domain.DynamicField> dynamicFields = null;
        JsonNode dfNode = payload.get("dynamicFields");
        if (dfNode != null && dfNode.isArray()) {
            try {
                dynamicFields = objectMapper.convertValue(dfNode,
                        objectMapper.getTypeFactory().constructCollectionType(List.class,
                                com.dashboard.command.synthetic.domain.DynamicField.class));
            } catch (Exception ignored) { /* ignore malformed dynamic fields */ }
        }
        String rendered = dynamicFields != null
                ? dynamicFieldsResolver.apply(afterTemplates, dynamicFields)
                : afterTemplates;

        return Mono.just(ResponseEntity.ok(Map.of("rendered", rendered)));
    }

    private Map<String, String> renderHeaderMap(Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) return headers;
        Map<String, String> out = new HashMap<>(headers.size());
        headers.forEach((k, v) -> out.put(k, templateResolver.render(v)));
        return out;
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
                .dynamicFields(request.getDynamicFields())
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

    // ----- Synthetic Transactions CRUD -----

    @GetMapping("/transactions")
    public Flux<SyntheticTransactionResponseDto> listTransactions() {
        return transactionRepository.findAll().map(this::toTxResponse);
    }

    @PostMapping("/transactions")
    public Mono<ResponseEntity<?>> createTransaction(@RequestBody SyntheticTransactionDto request) {
        String validationError = validateTxDto(request);
        if (validationError != null) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", validationError)));
        }
        SyntheticTransaction tx = SyntheticTransaction.builder()
                .name(request.getName().trim())
                .mode(request.getMode().toLowerCase())
                .config(request.getConfig().toString())
                .intervalSeconds(request.getIntervalSeconds())
                .enabled(request.getEnabled() == null || request.getEnabled())
                .build();
        return transactionRepository.save(tx)
                .<ResponseEntity<?>>map(saved -> ResponseEntity.ok(toTxResponse(saved)));
    }

    @PutMapping("/transactions/{id}")
    public Mono<ResponseEntity<?>> updateTransaction(@PathVariable Long id,
                                                      @RequestBody SyntheticTransactionDto request) {
        String validationError = validateTxDto(request);
        if (validationError != null) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", validationError)));
        }
        return transactionRepository.findById(id)
                .<ResponseEntity<?>>flatMap(existing -> {
                    existing.setName(request.getName().trim());
                    existing.setMode(request.getMode().toLowerCase());
                    existing.setConfig(request.getConfig().toString());
                    existing.setIntervalSeconds(request.getIntervalSeconds());
                    existing.setEnabled(request.getEnabled() == null || request.getEnabled());
                    return transactionRepository.update(existing)
                            .map(saved -> ResponseEntity.ok(toTxResponse(saved)));
                })
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/transactions/{id}")
    public Mono<ResponseEntity<Void>> deleteTransaction(@PathVariable Long id) {
        return transactionRepository.deleteById(id)
                .thenReturn(ResponseEntity.noContent().<Void>build());
    }

    @PostMapping("/transactions/{id}/run")
    public Mono<ResponseEntity<?>> runTransaction(@PathVariable Long id) {
        return transactionRepository.findById(id)
                .<ResponseEntity<?>>flatMap(tx -> runUseCase.run(tx, "manual")
                        .flatMap(run -> {
                            Instant nextRunAt = tx.isEnabled() && tx.getIntervalSeconds() != null
                                    ? Instant.now().plusSeconds(tx.getIntervalSeconds())
                                    : tx.getNextRunAt();
                            return transactionRepository.updateRunTracking(tx.getId(),
                                            run.getStartedAt(), nextRunAt, run.getStatus())
                                    .thenReturn(ResponseEntity.ok(toRunResponse(run, tx)));
                        }))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @GetMapping("/runs")
    public Flux<SyntheticRunResponseDto> listRuns(@RequestParam(required = false) Long transactionId,
                                                   @RequestParam(defaultValue = "50") int limit) {
        Flux<SyntheticRun> runs = transactionId != null
                ? runRepository.findByTransaction(transactionId, limit)
                : runRepository.findRecent(limit);

        return runs.collectList().flatMapMany(list -> {
            if (list.isEmpty()) return Flux.empty();
            List<Long> txIds = list.stream().map(SyntheticRun::getTransactionId)
                    .distinct().collect(Collectors.toList());
            return Flux.fromIterable(txIds)
                    .flatMap(transactionRepository::findById)
                    .collectMap(SyntheticTransaction::getId)
                    .flatMapMany(txMap -> Flux.fromIterable(list)
                            .map(run -> toRunResponse(run, txMap.get(run.getTransactionId()))));
        });
    }

    @GetMapping("/runs/{id}")
    public Mono<ResponseEntity<?>> getRun(@PathVariable Long id) {
        return runRepository.findById(id)
                .<ResponseEntity<?>>flatMap(run -> transactionRepository.findById(run.getTransactionId())
                        .map(tx -> ResponseEntity.ok(toRunResponse(run, tx)))
                        .defaultIfEmpty(ResponseEntity.ok(toRunResponse(run, null))))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    private String validateTxDto(SyntheticTransactionDto dto) {
        if (dto.getName() == null || dto.getName().isBlank()) return "Name is required";
        if (dto.getMode() == null || dto.getMode().isBlank()) return "Mode is required";
        if (!"rest".equalsIgnoreCase(dto.getMode()) && !"kafka".equalsIgnoreCase(dto.getMode())) {
            return "Mode must be 'rest' or 'kafka'";
        }
        if (dto.getConfig() == null || dto.getConfig().isNull()) return "Config is required";
        if (dto.getIntervalSeconds() != null && dto.getIntervalSeconds() < 5) {
            return "Interval must be at least 5 seconds";
        }
        return null;
    }

    private SyntheticTransactionResponseDto toTxResponse(SyntheticTransaction tx) {
        JsonNode config = null;
        try {
            config = tx.getConfig() != null ? objectMapper.readTree(tx.getConfig()) : null;
        } catch (Exception ignored) { /* leave null */ }
        return SyntheticTransactionResponseDto.builder()
                .id(tx.getId())
                .name(tx.getName())
                .mode(tx.getMode())
                .config(config)
                .intervalSeconds(tx.getIntervalSeconds())
                .enabled(tx.isEnabled())
                .nextRunAt(tx.getNextRunAt())
                .lastRunAt(tx.getLastRunAt())
                .lastStatus(tx.getLastStatus())
                .createdAt(tx.getCreatedAt())
                .updatedAt(tx.getUpdatedAt())
                .build();
    }

    private SyntheticRunResponseDto toRunResponse(SyntheticRun run, SyntheticTransaction tx) {
        JsonNode result = null;
        try {
            result = run.getResult() != null ? objectMapper.readTree(run.getResult()) : null;
        } catch (Exception ignored) { /* leave null */ }
        return SyntheticRunResponseDto.builder()
                .id(run.getId())
                .transactionId(run.getTransactionId())
                .transactionName(tx != null ? tx.getName() : null)
                .mode(tx != null ? tx.getMode() : null)
                .status(run.getStatus())
                .triggerType(run.getTriggerType())
                .startedAt(run.getStartedAt())
                .finishedAt(run.getFinishedAt())
                .elapsedMs(run.getElapsedMs())
                .result(result)
                .error(run.getError())
                .build();
    }
}
