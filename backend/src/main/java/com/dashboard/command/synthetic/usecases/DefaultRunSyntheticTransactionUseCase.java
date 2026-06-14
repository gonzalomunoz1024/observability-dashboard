package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.SyntheticRun;
import com.dashboard.command.synthetic.domain.SyntheticTransaction;
import com.dashboard.command.synthetic.domain.command.InjectEventCommand;
import com.dashboard.command.synthetic.domain.command.RestInjectCommand;
import com.dashboard.command.synthetic.domain.command.TraceEventCommand;
import com.dashboard.command.synthetic.ports.outbound.SyntheticRunRepositoryPort;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultRunSyntheticTransactionUseCase implements RunSyntheticTransactionUseCase {

    private final SyntheticRunRepositoryPort runRepository;
    private final RestInjectAndProbeUseCase restInjectAndProbeUseCase;
    private final InjectEventUseCase injectEventUseCase;
    private final TraceEventUseCase traceEventUseCase;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<SyntheticRun> run(SyntheticTransaction tx, String triggerType) {
        long start = System.currentTimeMillis();
        SyntheticRun seed = SyntheticRun.builder()
                .transactionId(tx.getId())
                .status("running")
                .triggerType(triggerType)
                .startedAt(Instant.ofEpochMilli(start))
                .build();

        return runRepository.save(seed).flatMap(saved -> execute(tx, saved, start)
                .onErrorResume(err -> {
                    log.warn("Synthetic transaction {} failed: {}", tx.getId(), err.getMessage());
                    return runRepository.updateResult(saved.getId(), "error", null,
                            err.getMessage(), System.currentTimeMillis() - start);
                }));
    }

    private Mono<SyntheticRun> execute(SyntheticTransaction tx, SyntheticRun run, long start) {
        if ("rest".equalsIgnoreCase(tx.getMode())) {
            return executeRest(tx, run, start);
        }
        if ("kafka".equalsIgnoreCase(tx.getMode())) {
            return executeKafka(tx, run, start);
        }
        return runRepository.updateResult(run.getId(), "error", null,
                "Unknown mode: " + tx.getMode(), System.currentTimeMillis() - start);
    }

    private Mono<SyntheticRun> executeRest(SyntheticTransaction tx, SyntheticRun run, long start) {
        JsonNode config;
        try {
            config = objectMapper.readTree(tx.getConfig());
        } catch (Exception e) {
            return runRepository.updateResult(run.getId(), "error", null,
                    "Invalid config JSON: " + e.getMessage(), System.currentTimeMillis() - start);
        }

        RestInjectCommand command = RestInjectCommand.builder()
                .startUrl(textOr(config, "startUrl", ""))
                .method(textOr(config, "method", "POST"))
                .body(textOr(config, "body", null))
                .headers(asStringMap(config.get("headers")))
                .probeUrl(textOr(config, "probeUrl", ""))
                .idJsonPath(textOr(config, "idJsonPath", null))
                .statusJsonPath(textOr(config, "statusJsonPath", "$.status"))
                .expectedStatusValue(textOr(config, "expectedStatusValue", ""))
                .timeout(longOr(config, "timeout", 30000))
                .pollInterval(longOr(config, "pollInterval", 1000))
                .build();

        return restInjectAndProbeUseCase.execute(command)
                .flatMap(result -> {
                    String json;
                    try {
                        json = objectMapper.writeValueAsString(result);
                    } catch (Exception e) {
                        json = null;
                    }
                    String status = mapStatus(result.getStatus());
                    String error = result.getError();
                    return runRepository.updateResult(run.getId(), status, json, error,
                            System.currentTimeMillis() - start);
                });
    }

    private Mono<SyntheticRun> executeKafka(SyntheticTransaction tx, SyntheticRun run, long start) {
        JsonNode config;
        try {
            config = objectMapper.readTree(tx.getConfig());
        } catch (Exception e) {
            return runRepository.updateResult(run.getId(), "error", null,
                    "Invalid config JSON: " + e.getMessage(), System.currentTimeMillis() - start);
        }

        String topic = textOr(config, "topic", "");
        String eventType = textOr(config, "eventType", "");
        String expectedFlow = textOr(config, "expectedFlow", "");
        long timeout = longOr(config, "timeout", 30000);

        Map<String, Object> payload = new HashMap<>();
        JsonNode payloadNode = config.get("payload");
        if (payloadNode != null && payloadNode.isObject()) {
            payload = objectMapper.convertValue(payloadNode, Map.class);
        }

        InjectEventCommand injectCommand = InjectEventCommand.builder()
                .topic(topic)
                .eventType(eventType)
                .payload(payload)
                .build();

        return injectEventUseCase.execute(injectCommand)
                .flatMap(event -> traceEventUseCase.execute(TraceEventCommand.builder()
                        .correlationId(event.getCorrelationId())
                        .expectedFlow(expectedFlow)
                        .timeout(timeout)
                        .build())
                        .flatMap(traceResult -> {
                            Map<String, Object> snapshot = new HashMap<>();
                            snapshot.put("correlationId", event.getCorrelationId());
                            snapshot.put("status", traceResult.getStatus());
                            snapshot.put("expectedFlow", traceResult.getExpectedFlow());
                            snapshot.put("completedSteps", traceResult.getCompletedSteps());
                            snapshot.put("missingSteps", traceResult.getMissingSteps());
                            snapshot.put("elapsedTime", traceResult.getElapsedTime());

                            String json;
                            try {
                                json = objectMapper.writeValueAsString(snapshot);
                            } catch (Exception e) {
                                json = null;
                            }
                            String status = mapStatus(traceResult.getStatus());
                            return runRepository.updateResult(run.getId(), status, json, null,
                                    System.currentTimeMillis() - start);
                        }));
    }

    private String mapStatus(String inner) {
        if (inner == null) return "error";
        return switch (inner.toLowerCase()) {
            case "complete", "completed", "success" -> "complete";
            case "timeout" -> "timeout";
            case "error" -> "error";
            default -> inner;
        };
    }

    private String textOr(JsonNode node, String field, String fallback) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return fallback;
        return v.isTextual() ? v.asText() : v.toString();
    }

    private long longOr(JsonNode node, String field, long fallback) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return fallback;
        return v.isNumber() ? v.asLong() : fallback;
    }

    private Map<String, String> asStringMap(JsonNode node) {
        Map<String, String> out = new HashMap<>();
        if (node == null || !node.isObject()) return out;
        Iterator<Map.Entry<String, JsonNode>> it = node.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> entry = it.next();
            JsonNode v = entry.getValue();
            out.put(entry.getKey(), v.isTextual() ? v.asText() : v.toString());
        }
        return out;
    }
}
