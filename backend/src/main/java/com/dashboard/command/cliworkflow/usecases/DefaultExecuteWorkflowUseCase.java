package com.dashboard.command.cliworkflow.usecases;

import com.dashboard.command.cli.domain.CommandResult;
import com.dashboard.command.cli.domain.command.ExecuteCliCommand;
import com.dashboard.command.cli.usecases.ExecuteCommandUseCase;
import com.dashboard.command.cliworkflow.adapters.outbound.ExecutableStorageAdapter;
import com.dashboard.command.cliworkflow.domain.*;
import com.dashboard.command.cliworkflow.ports.inbound.ExecuteWorkflowPort;
import com.dashboard.command.cliworkflow.ports.outbound.ArtifactVerifierPort;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultExecuteWorkflowUseCase implements ExecuteWorkflowPort {

    private final ExecuteCommandUseCase executeCommandUseCase;
    private final ArtifactVerifierPort artifactVerifier;
    private final ExecutableStorageAdapter executableStorage;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<WorkflowResult> execute(Workflow workflow) {
        long startTime = System.currentTimeMillis();
        Map<String, String> variables = new HashMap<>();
        String uuid = UUID.randomUUID().toString().substring(0, 8);
        variables.put("uuid", uuid);

        // Create temp directory for this workflow run
        Path tempDir;
        try {
            tempDir = Files.createTempDirectory("workflow-" + uuid);
            variables.put("workDir", tempDir.toString());
            log.info("Created temp directory for workflow: {}", tempDir);
        } catch (IOException e) {
            log.error("Failed to create temp directory", e);
            return Mono.just(WorkflowResult.builder()
                    .workflowName(workflow.getName())
                    .passed(false)
                    .duration(0)
                    .variables(variables)
                    .steps(List.of())
                    .build());
        }

        Map<String, StepResult> completedSteps = new HashMap<>();

        return Flux.fromIterable(workflow.getSteps())
                .concatMap(step -> executeStep(step, workflow, variables, completedSteps, tempDir)
                        .doOnNext(result -> {
                            completedSteps.put(step.getId(), result);
                            if (result.getCapturedVariables() != null) {
                                variables.putAll(result.getCapturedVariables());
                            }
                        }))
                .collectList()
                .map(results -> {
                    long duration = System.currentTimeMillis() - startTime;
                    boolean allPassed = results.stream()
                            .filter(r -> !r.isSkipped())
                            .allMatch(StepResult::isPassed);

                    return WorkflowResult.builder()
                            .workflowName(workflow.getName())
                            .passed(allPassed)
                            .duration(duration)
                            .variables(variables)
                            .steps(results)
                            .build();
                })
                .doFinally(signal -> {
                    // Cleanup temp directory
                    try {
                        deleteDirectory(tempDir);
                        log.info("Cleaned up temp directory: {}", tempDir);
                    } catch (IOException e) {
                        log.warn("Failed to cleanup temp directory: {}", tempDir, e);
                    }
                });
    }

    private void deleteDirectory(Path directory) throws IOException {
        if (Files.exists(directory)) {
            Files.walkFileTree(directory, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        }
    }

    private Mono<StepResult> executeStep(WorkflowStep step, Workflow workflow,
                                          Map<String, String> variables,
                                          Map<String, StepResult> completedSteps,
                                          Path workDir) {
        // Check dependencies
        if (step.getDependsOn() != null && !step.getDependsOn().isEmpty()) {
            for (String depId : step.getDependsOn()) {
                StepResult depResult = completedSteps.get(depId);
                if (depResult == null || !depResult.isPassed()) {
                    return Mono.just(StepResult.builder()
                            .id(step.getId())
                            .name(step.getName())
                            .type(step.getType())
                            .passed(false)
                            .skipped(true)
                            .skipReason("Dependency '" + depId + "' failed or not found")
                            .build());
                }
            }
        }

        // Route to appropriate executor based on step type
        String stepType = step.getType() != null ? step.getType() : "command";
        if ("http".equals(stepType)) {
            return executeHttpStep(step, variables);
        } else {
            return executeCommandStep(step, workflow, variables, workDir);
        }
    }

    private Mono<StepResult> executeCommandStep(WorkflowStep step, Workflow workflow,
                                                  Map<String, String> variables, Path workDir) {
        // Resolve executable - check if it's an uploaded executable ID
        String executable = step.getExecutable();
        if (executable != null && !executable.contains("/") && !executable.contains("\\")) {
            // Could be an executable ID, try to resolve it
            String resolvedPath = executableStorage.getPath(executable);
            if (resolvedPath != null) {
                executable = resolvedPath;
                log.debug("Resolved executable ID '{}' to path '{}'", step.getExecutable(), executable);
            }
        }

        // Resolve variables in arguments
        List<String> resolvedArgs = step.getArgs() != null ?
                step.getArgs().stream()
                        .map(arg -> resolveVariables(arg, variables))
                        .collect(Collectors.toList()) :
                List.of();

        ExecuteCliCommand command = ExecuteCliCommand.builder()
                .executable(executable)
                .args(resolvedArgs)
                .timeout(step.getTimeout())
                .cwd(workDir.toString())
                .env(workflow.getEnv())
                .stdinInputs(step.getStdinInputs())
                .stdinDelay(step.getStdinDelay())
                .build();

        return executeCommandUseCase.execute(command)
                .flatMap(result -> processCommandStepResult(step, result, variables));
    }

    private Mono<StepResult> executeHttpStep(WorkflowStep step, Map<String, String> variables) {
        long startTime = System.currentTimeMillis();
        WorkflowStep.HttpConfig httpConfig = step.getHttp();

        if (httpConfig == null || httpConfig.getUrl() == null) {
            return Mono.just(StepResult.builder()
                    .id(step.getId())
                    .name(step.getName())
                    .type("http")
                    .passed(false)
                    .error("HTTP configuration or URL is missing")
                    .build());
        }

        String resolvedUrl = resolveVariables(httpConfig.getUrl(), variables);
        String resolvedBody = httpConfig.getBody() != null ?
                resolveVariables(httpConfig.getBody(), variables) : null;

        // Check if polling is enabled
        if (httpConfig.getPolling() != null && httpConfig.getPolling().isEnabled()) {
            return executeHttpWithPolling(step, resolvedUrl, resolvedBody, httpConfig, variables, startTime);
        } else {
            return executeHttpOnce(step, resolvedUrl, resolvedBody, httpConfig, variables)
                    .map(result -> {
                        result.setDuration(System.currentTimeMillis() - startTime);
                        return result;
                    });
        }
    }

    private Mono<StepResult> executeHttpWithPolling(WorkflowStep step, String url, String body,
                                                      WorkflowStep.HttpConfig httpConfig,
                                                      Map<String, String> variables, long startTime) {
        WorkflowStep.HttpPolling polling = httpConfig.getPolling();
        int intervalSeconds = polling.getIntervalSeconds() > 0 ? polling.getIntervalSeconds() : 30;
        int maxDurationMinutes = polling.getMaxDurationMinutes() > 0 ? polling.getMaxDurationMinutes() : 60;
        long maxDurationMs = maxDurationMinutes * 60 * 1000L;

        log.info("Starting HTTP polling for step '{}': interval={}s, maxDuration={}m",
                step.getId(), intervalSeconds, maxDurationMinutes);

        final int[] attemptCount = {0};

        return Mono.defer(() -> {
            attemptCount[0]++;
            log.debug("HTTP poll attempt {} for step '{}'", attemptCount[0], step.getId());
            return executeHttpOnce(step, url, body, httpConfig, variables);
        })
        .flatMap(result -> {
            // If expectations are met, return success
            if (result.isPassed()) {
                result.setPollAttempts(attemptCount[0]);
                result.setPollDuration(System.currentTimeMillis() - startTime);
                result.setDuration(System.currentTimeMillis() - startTime);
                log.info("HTTP polling for step '{}' succeeded after {} attempts", step.getId(), attemptCount[0]);
                return Mono.just(result);
            }

            // Check if we've exceeded max duration
            long elapsed = System.currentTimeMillis() - startTime;
            if (elapsed >= maxDurationMs) {
                result.setPollAttempts(attemptCount[0]);
                result.setPollDuration(elapsed);
                result.setDuration(elapsed);
                result.setError("Polling timed out after " + maxDurationMinutes + " minutes");
                log.warn("HTTP polling for step '{}' timed out after {} attempts", step.getId(), attemptCount[0]);
                return Mono.just(result);
            }

            // Continue polling - throw exception to trigger retry
            return Mono.error(new RuntimeException("Expectations not met, will retry"));
        })
        .retryWhen(Retry.fixedDelay(Long.MAX_VALUE, Duration.ofSeconds(intervalSeconds))
                .filter(e -> {
                    long elapsed = System.currentTimeMillis() - startTime;
                    return elapsed < maxDurationMs;
                }))
        .onErrorResume(e -> {
            // Final failure after all retries exhausted
            log.warn("HTTP polling for step '{}' failed: {}", step.getId(), e.getMessage());
            return Mono.just(StepResult.builder()
                    .id(step.getId())
                    .name(step.getName())
                    .type("http")
                    .passed(false)
                    .pollAttempts(attemptCount[0])
                    .pollDuration(System.currentTimeMillis() - startTime)
                    .duration(System.currentTimeMillis() - startTime)
                    .error("Polling failed: " + e.getMessage())
                    .build());
        });
    }

    private Mono<StepResult> executeHttpOnce(WorkflowStep step, String url, String body,
                                               WorkflowStep.HttpConfig httpConfig,
                                               Map<String, String> variables) {
        HttpMethod method = HttpMethod.valueOf(httpConfig.getMethod().toUpperCase());

        WebClient.RequestBodySpec requestSpec = webClient
                .method(method)
                .uri(url);

        // Add headers
        if (httpConfig.getHeaders() != null) {
            httpConfig.getHeaders().forEach((key, value) ->
                    requestSpec.header(key, resolveVariables(value, variables)));
        }

        // Add body for POST/PUT/PATCH
        WebClient.RequestHeadersSpec<?> finalSpec;
        if (body != null && (method == HttpMethod.POST || method == HttpMethod.PUT || method == HttpMethod.PATCH)) {
            finalSpec = requestSpec
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body);
        } else {
            finalSpec = requestSpec;
        }

        return finalSpec.exchangeToMono(response -> {
            int statusCode = response.statusCode().value();
            Map<String, String> responseHeaders = new HashMap<>();
            response.headers().asHttpHeaders().forEach((key, values) -> {
                if (!values.isEmpty()) {
                    responseHeaders.put(key, values.get(0));
                }
            });

            return response.bodyToMono(String.class)
                    .defaultIfEmpty("")
                    .map(responseBody -> processHttpResponse(step, statusCode, responseBody,
                            responseHeaders, httpConfig, variables));
        })
        .onErrorResume(WebClientResponseException.class, e -> {
            log.warn("HTTP request failed for step '{}': {} {}", step.getId(), e.getStatusCode(), e.getMessage());
            return Mono.just(StepResult.builder()
                    .id(step.getId())
                    .name(step.getName())
                    .type("http")
                    .passed(false)
                    .statusCode(e.getStatusCode().value())
                    .responseBody(e.getResponseBodyAsString())
                    .error("HTTP error: " + e.getMessage())
                    .build());
        })
        .onErrorResume(e -> {
            log.error("HTTP request failed for step '{}': {}", step.getId(), e.getMessage());
            return Mono.just(StepResult.builder()
                    .id(step.getId())
                    .name(step.getName())
                    .type("http")
                    .passed(false)
                    .error("Request failed: " + e.getMessage())
                    .build());
        });
    }

    private StepResult processHttpResponse(WorkflowStep step, int statusCode, String responseBody,
                                             Map<String, String> responseHeaders,
                                             WorkflowStep.HttpConfig httpConfig,
                                             Map<String, String> variables) {
        List<StepResult.ValidationItem> validations = new ArrayList<>();
        boolean allPassed = true;

        WorkflowStep.HttpExpect expect = httpConfig.getExpect();
        if (expect != null) {
            // Validate status code
            if (expect.getStatusCode() > 0) {
                boolean statusMatch = statusCode == expect.getStatusCode();
                validations.add(StepResult.ValidationItem.builder()
                        .type("statusCode")
                        .expected(expect.getStatusCode())
                        .actual(statusCode)
                        .passed(statusMatch)
                        .build());
                if (!statusMatch) allPassed = false;
            }

            // Validate body contains
            if (expect.getBodyContains() != null && !expect.getBodyContains().isEmpty()) {
                String resolvedExpected = resolveVariables(expect.getBodyContains(), variables);
                boolean contains = responseBody.contains(resolvedExpected);
                validations.add(StepResult.ValidationItem.builder()
                        .type("bodyContains")
                        .expected(resolvedExpected)
                        .passed(contains)
                        .build());
                if (!contains) allPassed = false;
            }

            // Validate JSON path
            if (expect.getJsonPath() != null && !expect.getJsonPath().isEmpty()) {
                try {
                    Object actualValue = JsonPath.read(responseBody, expect.getJsonPath());
                    String expectedValue = expect.getJsonPathValue() != null ?
                            resolveVariables(expect.getJsonPathValue(), variables) : null;

                    boolean matches;
                    if (expectedValue != null) {
                        matches = String.valueOf(actualValue).equals(expectedValue);
                    } else {
                        matches = actualValue != null;
                    }

                    validations.add(StepResult.ValidationItem.builder()
                            .type("jsonPath")
                            .expected(expectedValue != null ? expectedValue : "exists")
                            .actual(actualValue)
                            .passed(matches)
                            .build());
                    if (!matches) allPassed = false;
                } catch (PathNotFoundException e) {
                    validations.add(StepResult.ValidationItem.builder()
                            .type("jsonPath")
                            .expected(expect.getJsonPath())
                            .actual("path not found")
                            .passed(false)
                            .build());
                    allPassed = false;
                } catch (Exception e) {
                    validations.add(StepResult.ValidationItem.builder()
                            .type("jsonPath")
                            .expected(expect.getJsonPath())
                            .actual("error: " + e.getMessage())
                            .passed(false)
                            .build());
                    allPassed = false;
                }
            }
        }

        // Capture variables from HTTP response
        Map<String, String> capturedVariables = new HashMap<>();
        if (httpConfig.getCapture() != null) {
            for (Map.Entry<String, WorkflowStep.HttpCaptureRule> entry : httpConfig.getCapture().entrySet()) {
                String varName = entry.getKey();
                WorkflowStep.HttpCaptureRule rule = entry.getValue();

                try {
                    String source = "body".equals(rule.getSource()) ? responseBody :
                            responseHeaders.getOrDefault(rule.getSource(), "");

                    if (rule.getJsonPath() != null) {
                        Object value = JsonPath.read(source, rule.getJsonPath());
                        capturedVariables.put(varName, String.valueOf(value));
                    } else if (rule.getRegex() != null) {
                        Pattern pattern = Pattern.compile(rule.getRegex());
                        Matcher matcher = pattern.matcher(source);
                        if (matcher.find() && matcher.groupCount() > 0) {
                            capturedVariables.put(varName, matcher.group(1));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to capture variable '{}' in step '{}': {}",
                            varName, step.getId(), e.getMessage());
                }
            }
        }

        return StepResult.builder()
                .id(step.getId())
                .name(step.getName())
                .type("http")
                .passed(allPassed)
                .statusCode(statusCode)
                .responseBody(responseBody)
                .responseHeaders(responseHeaders)
                .capturedVariables(capturedVariables.isEmpty() ? null : capturedVariables)
                .validations(validations.isEmpty() ? null : validations)
                .build();
    }

    private Mono<StepResult> processCommandStepResult(WorkflowStep step, CommandResult result,
                                                        Map<String, String> variables) {
        // Validate expectations
        List<StepResult.ValidationItem> validations = validateExpectations(step.getExpectations(), result);
        boolean expectationsPassed = validations.isEmpty() || validations.stream().allMatch(StepResult.ValidationItem::isPassed);

        // Capture variables
        Map<String, String> capturedVariables = new HashMap<>();
        if (step.getCapture() != null) {
            for (Map.Entry<String, CaptureRule> entry : step.getCapture().entrySet()) {
                String varName = entry.getKey();
                CaptureRule rule = entry.getValue();
                String source = "stdout".equals(rule.getSource()) ? result.getStdout() : result.getStderr();

                if (rule.getRegex() != null) {
                    Pattern pattern = Pattern.compile(rule.getRegex());
                    Matcher matcher = pattern.matcher(source);
                    if (matcher.find() && matcher.groupCount() > 0) {
                        capturedVariables.put(varName, matcher.group(1));
                    }
                }
            }
        }

        // Merge captured variables for artifact resolution
        Map<String, String> allVariables = new HashMap<>(variables);
        allVariables.putAll(capturedVariables);

        // Verify artifacts
        return verifyArtifacts(step.getArtifacts(), allVariables)
                .collectList()
                .map(artifactResults -> {
                    boolean artifactsPassed = artifactResults.isEmpty() ||
                            artifactResults.stream().allMatch(ArtifactResult::isPassed);

                    return StepResult.builder()
                            .id(step.getId())
                            .name(step.getName())
                            .type("command")
                            .passed(expectationsPassed && artifactsPassed && result.getExitCode() == 0)
                            .skipped(false)
                            .exitCode(result.getExitCode())
                            .stdout(result.getStdout())
                            .stderr(result.getStderr())
                            .duration(result.getDuration())
                            .timedOut(result.isTimedOut())
                            .error(result.getError())
                            .capturedVariables(capturedVariables.isEmpty() ? null : capturedVariables)
                            .artifactResults(artifactResults.isEmpty() ? null : artifactResults)
                            .validations(validations.isEmpty() ? null : validations)
                            .build();
                });
    }

    private List<StepResult.ValidationItem> validateExpectations(WorkflowStep.StepExpectations expectations,
                                                                   CommandResult result) {
        List<StepResult.ValidationItem> validations = new ArrayList<>();

        if (expectations == null) {
            return validations;
        }

        if (expectations.getExitCode() != null) {
            validations.add(StepResult.ValidationItem.builder()
                    .type("exitCode")
                    .expected(expectations.getExitCode())
                    .actual(result.getExitCode())
                    .passed(result.getExitCode() == expectations.getExitCode())
                    .build());
        }

        if (expectations.getStdoutContains() != null && !expectations.getStdoutContains().isEmpty()) {
            boolean contains = expectations.getStdoutContains().stream()
                    .allMatch(s -> result.getStdout().contains(s));
            validations.add(StepResult.ValidationItem.builder()
                    .type("stdoutContains")
                    .expected(expectations.getStdoutContains())
                    .passed(contains)
                    .build());
        }

        if (expectations.getStdoutMatches() != null) {
            boolean matches = Pattern.compile(expectations.getStdoutMatches())
                    .matcher(result.getStdout()).find();
            validations.add(StepResult.ValidationItem.builder()
                    .type("stdoutMatches")
                    .expected(expectations.getStdoutMatches())
                    .passed(matches)
                    .build());
        }

        if (expectations.getStderrEmpty() != null && expectations.getStderrEmpty()) {
            validations.add(StepResult.ValidationItem.builder()
                    .type("stderrEmpty")
                    .expected(true)
                    .actual(result.getStderr().isEmpty())
                    .passed(result.getStderr().isEmpty())
                    .build());
        }

        if (expectations.getStderrContains() != null && !expectations.getStderrContains().isEmpty()) {
            boolean contains = expectations.getStderrContains().stream()
                    .allMatch(s -> result.getStderr().contains(s));
            validations.add(StepResult.ValidationItem.builder()
                    .type("stderrContains")
                    .expected(expectations.getStderrContains())
                    .passed(contains)
                    .build());
        }

        if (expectations.getMaxDuration() != null) {
            validations.add(StepResult.ValidationItem.builder()
                    .type("maxDuration")
                    .expected(expectations.getMaxDuration())
                    .actual(result.getDuration())
                    .passed(result.getDuration() <= expectations.getMaxDuration())
                    .build());
        }

        return validations;
    }

    private Flux<ArtifactResult> verifyArtifacts(List<ArtifactCheck> artifacts,
                                                  Map<String, String> variables) {
        if (artifacts == null || artifacts.isEmpty()) {
            return Flux.empty();
        }

        return Flux.fromIterable(artifacts)
                .flatMap(check -> {
                    String resolvedPath = resolveVariables(check.getPath(), variables);
                    return artifactVerifier.verify(check, resolvedPath);
                });
    }

    private String resolveVariables(String template, Map<String, String> variables) {
        if (template == null) return null;

        String result = template;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            result = result.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return result;
    }
}
