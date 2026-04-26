package com.dashboard.command.cliworkflow.adapters.inbound;

import com.dashboard.command.cliworkflow.adapters.outbound.ExecutableStorageAdapter;
import com.dashboard.command.cliworkflow.domain.*;
import com.dashboard.command.cliworkflow.dto.inbound.WorkflowRequestDto;
import com.dashboard.command.cliworkflow.dto.outbound.WorkflowResultDto;
import com.dashboard.command.cliworkflow.ports.inbound.ExecuteWorkflowPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/cli")
@RequiredArgsConstructor
public class RestControllerWorkflowInboundAdapter {

    private final ExecuteWorkflowPort executeWorkflowPort;
    private final ExecutableStorageAdapter executableStorage;

    @PostMapping("/workflow")
    public Mono<ResponseEntity<?>> executeWorkflow(@RequestBody WorkflowRequestDto request) {
        if (request.getSteps() == null || request.getSteps().isEmpty()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "At least one step is required")));
        }

        Workflow workflow = mapToDomain(request);

        return executeWorkflowPort.execute(workflow)
                .map(result -> ResponseEntity.ok(mapToDto(result)));
    }

    @PostMapping("/executable/upload")
    public Mono<ResponseEntity<Map<String, Object>>> uploadExecutable(@RequestPart("file") FilePart filePart) {
        return executableStorage.store(filePart)
                .<ResponseEntity<Map<String, Object>>>map(info -> ResponseEntity.ok(Map.of(
                        "id", info.id(),
                        "name", info.originalName(),
                        "path", info.path()
                )))
                .onErrorResume(e -> {
                    log.error("Failed to upload executable", e);
                    return Mono.just(ResponseEntity.badRequest()
                            .body(Map.of("error", "Failed to upload: " + e.getMessage())));
                });
    }

    @GetMapping("/executable")
    public ResponseEntity<?> listExecutables() {
        var executables = executableStorage.listAll();
        var list = executables.values().stream()
                .map(info -> Map.of(
                        "id", info.id(),
                        "name", info.originalName()
                ))
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @DeleteMapping("/executable/{id}")
    public ResponseEntity<?> deleteExecutable(@PathVariable String id) {
        boolean deleted = executableStorage.delete(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("deleted", true));
        }
        return ResponseEntity.notFound().build();
    }

    private Workflow mapToDomain(WorkflowRequestDto request) {
        List<WorkflowStep> steps = request.getSteps().stream()
                .map(this::mapStepToDomain)
                .collect(Collectors.toList());

        return Workflow.builder()
                .name(request.getName())
                .env(request.getEnv())
                .steps(steps)
                .build();
    }

    private WorkflowStep mapStepToDomain(WorkflowRequestDto.StepDto dto) {
        WorkflowStep.StepExpectations expectations = null;
        if (dto.getExpectations() != null) {
            expectations = WorkflowStep.StepExpectations.builder()
                    .exitCode(dto.getExpectations().getExitCode())
                    .stdoutContains(dto.getExpectations().getStdoutContains())
                    .stdoutMatches(dto.getExpectations().getStdoutMatches())
                    .stderrEmpty(dto.getExpectations().getStderrEmpty())
                    .stderrContains(dto.getExpectations().getStderrContains())
                    .maxDuration(dto.getExpectations().getMaxDuration())
                    .build();
        }

        Map<String, CaptureRule> captureRules = null;
        if (dto.getCapture() != null) {
            captureRules = dto.getCapture().entrySet().stream()
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            e -> CaptureRule.builder()
                                    .source(e.getValue().getSource())
                                    .regex(e.getValue().getRegex())
                                    .build()
                    ));
        }

        List<ArtifactCheck> artifacts = null;
        if (dto.getArtifacts() != null) {
            artifacts = dto.getArtifacts().stream()
                    .map(a -> ArtifactCheck.builder()
                            .varName(a.getVarName())
                            .path(a.getPath())
                            .exists(a.isExists())
                            .contains(a.getContains())
                            .yamlValid(a.isYamlValid())
                            .jsonValid(a.isJsonValid())
                            .isDirectory(a.isDirectory())
                            .build())
                    .collect(Collectors.toList());
        }

        // Map HTTP configuration
        WorkflowStep.HttpConfig httpConfig = null;
        if (dto.getHttp() != null) {
            WorkflowRequestDto.HttpConfigDto httpDto = dto.getHttp();

            WorkflowStep.HttpPolling polling = null;
            if (httpDto.getPolling() != null) {
                polling = WorkflowStep.HttpPolling.builder()
                        .enabled(httpDto.getPolling().isEnabled())
                        .intervalSeconds(httpDto.getPolling().getIntervalSeconds())
                        .maxDurationMinutes(httpDto.getPolling().getMaxDurationMinutes())
                        .build();
            }

            WorkflowStep.HttpExpect expect = null;
            if (httpDto.getExpect() != null) {
                expect = WorkflowStep.HttpExpect.builder()
                        .statusCode(httpDto.getExpect().getStatusCode())
                        .bodyContains(httpDto.getExpect().getBodyContains())
                        .jsonPath(httpDto.getExpect().getJsonPath())
                        .jsonPathValue(httpDto.getExpect().getJsonPathValue())
                        .build();
            }

            Map<String, WorkflowStep.HttpCaptureRule> httpCapture = null;
            if (httpDto.getCapture() != null) {
                httpCapture = httpDto.getCapture().entrySet().stream()
                        .collect(Collectors.toMap(
                                Map.Entry::getKey,
                                e -> WorkflowStep.HttpCaptureRule.builder()
                                        .source(e.getValue().getSource())
                                        .jsonPath(e.getValue().getJsonPath())
                                        .regex(e.getValue().getRegex())
                                        .build()
                        ));
            }

            httpConfig = WorkflowStep.HttpConfig.builder()
                    .method(httpDto.getMethod())
                    .url(httpDto.getUrl())
                    .headers(httpDto.getHeaders())
                    .body(httpDto.getBody())
                    .polling(polling)
                    .expect(expect)
                    .capture(httpCapture)
                    .build();
        }

        return WorkflowStep.builder()
                .id(dto.getId())
                .name(dto.getName())
                .type(dto.getType() != null ? dto.getType() : "command")
                .executable(dto.getExecutable())
                .args(dto.getArgs())
                .timeout(dto.getTimeout())
                .dependsOn(dto.getDependsOn())
                .stdinInputs(dto.getStdinInputs())
                .stdinDelay(dto.getStdinDelay())
                .http(httpConfig)
                .expectations(expectations)
                .capture(captureRules)
                .artifacts(artifacts)
                .build();
    }

    private WorkflowResultDto mapToDto(WorkflowResult result) {
        List<WorkflowResultDto.StepResultDto> stepResults = result.getSteps().stream()
                .map(this::mapStepResultToDto)
                .collect(Collectors.toList());

        int passed = (int) result.getSteps().stream()
                .filter(s -> !s.isSkipped() && s.isPassed()).count();
        int failed = (int) result.getSteps().stream()
                .filter(s -> !s.isSkipped() && !s.isPassed()).count();
        int skipped = (int) result.getSteps().stream()
                .filter(StepResult::isSkipped).count();
        int total = result.getSteps().size();
        String passRate = total > 0 ? String.format("%.1f%%", (passed * 100.0) / (total - skipped)) : "0%";

        return WorkflowResultDto.builder()
                .workflowName(result.getWorkflowName())
                .passed(result.isPassed())
                .duration(result.getDuration())
                .variables(result.getVariables())
                .steps(stepResults)
                .summary(WorkflowResultDto.SummaryDto.builder()
                        .total(total)
                        .passed(passed)
                        .failed(failed)
                        .skipped(skipped)
                        .passRate(passRate)
                        .build())
                .build();
    }

    private WorkflowResultDto.StepResultDto mapStepResultToDto(StepResult result) {
        List<WorkflowResultDto.ArtifactResultDto> artifactDtos = null;
        if (result.getArtifactResults() != null) {
            artifactDtos = result.getArtifactResults().stream()
                    .map(a -> WorkflowResultDto.ArtifactResultDto.builder()
                            .path(a.getPath())
                            .varName(a.getVarName())
                            .resolvedPath(a.getResolvedPath())
                            .exists(a.isExists())
                            .passed(a.isPassed())
                            .error(a.getError())
                            .build())
                    .collect(Collectors.toList());
        }

        List<WorkflowResultDto.ValidationItemDto> validationDtos = null;
        if (result.getValidations() != null) {
            validationDtos = result.getValidations().stream()
                    .map(v -> WorkflowResultDto.ValidationItemDto.builder()
                            .type(v.getType())
                            .expected(v.getExpected())
                            .actual(v.getActual())
                            .passed(v.isPassed())
                            .build())
                    .collect(Collectors.toList());
        }

        return WorkflowResultDto.StepResultDto.builder()
                .id(result.getId())
                .name(result.getName())
                .type(result.getType())
                .passed(result.isPassed())
                .skipped(result.isSkipped())
                .skipReason(result.getSkipReason())
                .exitCode(result.getExitCode())
                .stdout(result.getStdout())
                .stderr(result.getStderr())
                .duration(result.getDuration())
                .timedOut(result.isTimedOut())
                .error(result.getError())
                .statusCode(result.getStatusCode())
                .responseBody(result.getResponseBody())
                .responseHeaders(result.getResponseHeaders())
                .pollAttempts(result.getPollAttempts())
                .pollDuration(result.getPollDuration())
                .capturedVariables(result.getCapturedVariables())
                .artifactResults(artifactDtos)
                .validations(validationDtos)
                .build();
    }
}
