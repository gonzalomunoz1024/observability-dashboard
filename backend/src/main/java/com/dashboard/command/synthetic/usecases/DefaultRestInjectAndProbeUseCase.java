package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.HttpProbeResponse;
import com.dashboard.command.synthetic.domain.RestCheckResult;
import com.dashboard.command.synthetic.domain.command.RestInjectCommand;
import com.dashboard.command.synthetic.ports.outbound.HttpProbePort;
import com.jayway.jsonpath.JsonPath;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

// Start/probe URLs are user-supplied by design: this is a synthetic testing tool,
// same trust model as the health-check and CLI workflow features.
@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultRestInjectAndProbeUseCase implements RestInjectAndProbeUseCase {

    private static final String ID_PLACEHOLDER = "{{id}}";
    private static final int SNIPPET_MAX_LENGTH = 4096;
    private static final long MIN_POLL_INTERVAL = 250;

    private final HttpProbePort httpProbePort;
    private final TemplateResolver templateResolver;
    private final DynamicFieldsResolver dynamicFieldsResolver;

    @Override
    public Mono<RestCheckResult> execute(RestInjectCommand command) {
        long startTime = System.currentTimeMillis();

        String resolvedStartUrl = templateResolver.render(command.getStartUrl());
        String resolvedBody = dynamicFieldsResolver.apply(
                templateResolver.render(command.getBody()), command.getDynamicFields());
        Map<String, String> resolvedHeaders = renderHeaders(command.getHeaders());

        return httpProbePort.execute(resolvedStartUrl, command.getMethod(),
                        resolvedBody, resolvedHeaders)
                .onErrorResume(e -> Mono.just(HttpProbeResponse.builder()
                        .statusCode(-1)
                        .body("Request failed: " + e.getMessage())
                        .build()))
                .flatMap(startResponse -> handleStartResponse(command, startResponse, resolvedHeaders, startTime));
    }

    private Mono<RestCheckResult> handleStartResponse(RestInjectCommand command,
                                                      HttpProbeResponse startResponse,
                                                      Map<String, String> resolvedHeaders, long startTime) {
        if (startResponse.getStatusCode() < 200 || startResponse.getStatusCode() >= 300) {
            return Mono.just(errorResult(command, startResponse, null,
                    "Start endpoint returned status " + startResponse.getStatusCode(), startTime));
        }

        String extractedId = null;
        String probeUrl = templateResolver.render(command.getProbeUrl());

        if (probeUrl.contains(ID_PLACEHOLDER)) {
            try {
                Object idValue = JsonPath.read(startResponse.getBody(), command.getIdJsonPath());
                extractedId = String.valueOf(idValue);
                probeUrl = probeUrl.replace(ID_PLACEHOLDER, extractedId);
            } catch (Exception e) {
                return Mono.just(errorResult(command, startResponse, null,
                        "Failed to extract ID with path '" + command.getIdJsonPath() + "': " + e.getMessage(),
                        startTime));
            }
        }

        long pollInterval = Math.max(command.getPollInterval(), MIN_POLL_INTERVAL);
        AtomicInteger attempts = new AtomicInteger();
        AtomicReference<HttpProbeResponse> lastResponse = new AtomicReference<>();

        return pollProbe(command, probeUrl, extractedId, startResponse, resolvedHeaders,
                pollInterval, startTime, attempts, lastResponse);
    }

    private Mono<RestCheckResult> pollProbe(RestInjectCommand command, String probeUrl,
                                              String extractedId, HttpProbeResponse startResponse,
                                              Map<String, String> resolvedHeaders,
                                              long pollInterval, long startTime,
                                              AtomicInteger attempts,
                                              AtomicReference<HttpProbeResponse> lastResponse) {
        return httpProbePort.execute(probeUrl, "GET", null, resolvedHeaders)
                .onErrorResume(e -> Mono.just(HttpProbeResponse.builder()
                        .statusCode(-1)
                        .body("Request failed: " + e.getMessage())
                        .build()))
                .flatMap(response -> {
                    attempts.incrementAndGet();
                    lastResponse.set(response);
                    long elapsed = System.currentTimeMillis() - startTime;

                    String matchedValue = tryExtractStatus(response, command.getStatusJsonPath());
                    if (matchedValue != null && matchedValue.equals(command.getExpectedStatusValue())) {
                        return Mono.just(buildResult(command, "complete", extractedId, startResponse,
                                attempts.get(), response, matchedValue, null, elapsed));
                    }

                    if (elapsed >= command.getTimeout()) {
                        return Mono.just(buildResult(command, "timeout", extractedId, startResponse,
                                attempts.get(), response, null, null, elapsed));
                    }

                    return Mono.delay(Duration.ofMillis(pollInterval))
                            .flatMap(tick -> pollProbe(command, probeUrl, extractedId, startResponse,
                                    resolvedHeaders, pollInterval, startTime, attempts, lastResponse));
                });
    }

    private Map<String, String> renderHeaders(Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) return headers;
        Map<String, String> out = new HashMap<>(headers.size());
        headers.forEach((k, v) -> out.put(k, templateResolver.render(v)));
        return out;
    }

    private String tryExtractStatus(HttpProbeResponse response, String statusJsonPath) {
        if (response.getBody() == null || response.getBody().isBlank()) {
            return null;
        }
        try {
            Object value = JsonPath.read(response.getBody(), statusJsonPath);
            return value != null ? String.valueOf(value) : null;
        } catch (Exception e) {
            log.debug("Status extraction failed for path '{}': {}", statusJsonPath, e.getMessage());
            return null;
        }
    }

    private RestCheckResult errorResult(RestInjectCommand command, HttpProbeResponse startResponse,
                                        String extractedId, String error, long startTime) {
        return buildResult(command, "error", extractedId, startResponse, 0, null, null, error,
                System.currentTimeMillis() - startTime);
    }

    private RestCheckResult buildResult(RestInjectCommand command, String status, String extractedId,
                                        HttpProbeResponse startResponse, int attempts,
                                        HttpProbeResponse lastResponse, String matchedValue,
                                        String error, long elapsed) {
        return RestCheckResult.builder()
                .status(status)
                .extractedId(extractedId)
                .startStatusCode(startResponse != null ? startResponse.getStatusCode() : 0)
                .startResponseSnippet(startResponse != null ? truncate(startResponse.getBody()) : null)
                .attempts(attempts)
                .lastStatusCode(lastResponse != null ? lastResponse.getStatusCode() : 0)
                .lastResponseSnippet(lastResponse != null ? truncate(lastResponse.getBody()) : null)
                .matchedValue(matchedValue)
                .error(error)
                .elapsedTime(elapsed)
                .build();
    }

    private String truncate(String body) {
        if (body == null || body.length() <= SNIPPET_MAX_LENGTH) {
            return body;
        }
        return body.substring(0, SNIPPET_MAX_LENGTH) + "… [truncated]";
    }
}
