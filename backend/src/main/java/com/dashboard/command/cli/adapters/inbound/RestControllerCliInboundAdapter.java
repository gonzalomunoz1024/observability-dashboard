package com.dashboard.command.cli.adapters.inbound;

import com.dashboard.command.cli.domain.CommandResult;
import com.dashboard.command.cli.domain.ValidationResult;
import com.dashboard.command.cli.domain.command.ExecuteCliCommand;
import com.dashboard.command.cli.dto.inbound.ExecuteRequestDto;
import com.dashboard.command.cli.dto.inbound.ParallelSuiteRequestDto;
import com.dashboard.command.cli.dto.inbound.TestSuiteRequestDto;
import com.dashboard.command.cli.dto.outbound.CommandResultDto;
import com.dashboard.command.cli.dto.outbound.ParallelSuiteResultDto;
import com.dashboard.command.cli.dto.outbound.TestSuiteResultDto;
import com.dashboard.command.cli.usecases.ExecuteCommandUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cli")
@RequiredArgsConstructor
public class RestControllerCliInboundAdapter {

    private final ExecuteCommandUseCase executeCommandUseCase;

    @PostMapping("/execute")
    public Mono<ResponseEntity<?>> execute(@RequestBody ExecuteRequestDto request) {
        if (request.getExecutable() == null || request.getExecutable().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Executable path is required")));
        }

        ExecuteCliCommand command = ExecuteCliCommand.builder()
                .executable(request.getExecutable())
                .args(request.getArgs())
                .timeout(request.getTimeout())
                .cwd(request.getCwd())
                .env(request.getEnv())
                .stdinInputs(request.getStdinInputs())
                .stdinDelay(request.getStdinDelay())
                .build();

        return executeCommandUseCase.execute(command)
                .map(result -> ResponseEntity.ok(mapToDto(result)));
    }

    @PostMapping("/suite")
    public Mono<ResponseEntity<?>> runSuite(@RequestBody TestSuiteRequestDto request) {
        if (request.getExecutable() == null || request.getExecutable().isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Executable path is required")));
        }
        if (request.getTests() == null || request.getTests().isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "At least one test is required")));
        }

        return Flux.fromIterable(request.getTests())
                .concatMap(test -> {
                    ExecuteCliCommand command = ExecuteCliCommand.builder()
                            .executable(request.getExecutable())
                            .args(test.getArgs())
                            .timeout(test.getTimeout())
                            .cwd(request.getCwd())
                            .env(request.getEnv())
                            .stdinInputs(test.getStdinInputs())
                            .stdinDelay(test.getStdinDelay())
                            .build();

                    return executeCommandUseCase.execute(command)
                            .map(result -> {
                                ValidationResult validation = validateResult(result, test.getExpectations());
                                return TestSuiteResultDto.TestResultDto.builder()
                                        .name(test.getName() != null ? test.getName() : String.join(" ", test.getArgs()))
                                        .args(test.getArgs())
                                        .exitCode(result.getExitCode())
                                        .stdout(result.getStdout())
                                        .stderr(result.getStderr())
                                        .duration(result.getDuration())
                                        .timedOut(result.isTimedOut())
                                        .validation(mapValidation(validation))
                                        .build();
                            });
                })
                .collectList()
                .map(results -> {
                    int passed = (int) results.stream().filter(r -> r.getValidation().isPassed()).count();
                    int failed = results.size() - passed;
                    String passRate = String.format("%.1f%%", (passed * 100.0) / results.size());

                    TestSuiteResultDto response = TestSuiteResultDto.builder()
                            .summary(TestSuiteResultDto.SummaryDto.builder()
                                    .total(results.size())
                                    .passed(passed)
                                    .failed(failed)
                                    .passRate(passRate)
                                    .build())
                            .results(results)
                            .build();

                    return ResponseEntity.ok(response);
                });
    }

    @PostMapping("/suite/parallel")
    public Mono<ResponseEntity<?>> runSuiteParallel(@RequestBody ParallelSuiteRequestDto request) {
        if (request.getTests() == null || request.getTests().isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "At least one test is required")));
        }

        long startTime = System.currentTimeMillis();

        return Flux.fromIterable(request.getTests())
                .flatMap(test -> {
                    if (test.getExecutable() == null || test.getExecutable().isBlank()) {
                        return Mono.just(ParallelSuiteResultDto.TestResultDto.builder()
                                .id(test.getId())
                                .name(test.getName())
                                .passed(false)
                                .exitCode(-1)
                                .stderr("Executable path is required")
                                .duration(0)
                                .build());
                    }

                    ExecuteCliCommand command = ExecuteCliCommand.builder()
                            .executable(test.getExecutable())
                            .args(test.getArgs())
                            .timeout(test.getTimeout())
                            .cwd(test.getCwd())
                            .env(test.getEnv())
                            .build();

                    return executeCommandUseCase.execute(command)
                            .map(result -> {
                                List<ParallelSuiteResultDto.ValidationItemDto> validations =
                                    validateParallelResult(result, test.getExpectations());
                                boolean passed = validations.stream().allMatch(ParallelSuiteResultDto.ValidationItemDto::isPassed);

                                return ParallelSuiteResultDto.TestResultDto.builder()
                                        .id(test.getId())
                                        .name(test.getName() != null ? test.getName() : test.getExecutable())
                                        .executable(test.getExecutable())
                                        .args(test.getArgs())
                                        .passed(passed)
                                        .exitCode(result.getExitCode())
                                        .stdout(result.getStdout())
                                        .stderr(result.getStderr())
                                        .duration(result.getDuration())
                                        .timedOut(result.isTimedOut())
                                        .validations(validations)
                                        .build();
                            });
                })
                .collectList()
                .map(results -> {
                    long totalDuration = System.currentTimeMillis() - startTime;
                    int passedCount = (int) results.stream().filter(ParallelSuiteResultDto.TestResultDto::isPassed).count();
                    int failedCount = results.size() - passedCount;

                    ParallelSuiteResultDto response = ParallelSuiteResultDto.builder()
                            .suiteName(request.getName())
                            .passed(failedCount == 0)
                            .totalTests(results.size())
                            .passedCount(passedCount)
                            .failedCount(failedCount)
                            .duration(totalDuration)
                            .results(results)
                            .build();

                    return ResponseEntity.ok(response);
                });
    }

    private List<ParallelSuiteResultDto.ValidationItemDto> validateParallelResult(
            CommandResult result, ParallelSuiteRequestDto.ExpectationsDto expectations) {
        List<ParallelSuiteResultDto.ValidationItemDto> validations = new ArrayList<>();

        if (expectations == null) {
            // Default: check exit code is 0
            validations.add(ParallelSuiteResultDto.ValidationItemDto.builder()
                    .type("exitCode")
                    .expected(0)
                    .actual(result.getExitCode())
                    .passed(result.getExitCode() == 0)
                    .build());
            return validations;
        }

        if (expectations.getExitCode() != null) {
            validations.add(ParallelSuiteResultDto.ValidationItemDto.builder()
                    .type("exitCode")
                    .expected(expectations.getExitCode())
                    .actual(result.getExitCode())
                    .passed(result.getExitCode() == expectations.getExitCode())
                    .build());
        }

        if (expectations.getStdoutContains() != null && !expectations.getStdoutContains().isEmpty()) {
            boolean contains = expectations.getStdoutContains().stream()
                    .allMatch(s -> result.getStdout().contains(s));
            validations.add(ParallelSuiteResultDto.ValidationItemDto.builder()
                    .type("stdoutContains")
                    .expected(expectations.getStdoutContains())
                    .passed(contains)
                    .build());
        }

        if (expectations.getStdoutMatches() != null) {
            boolean matches = Pattern.compile(expectations.getStdoutMatches()).matcher(result.getStdout()).find();
            validations.add(ParallelSuiteResultDto.ValidationItemDto.builder()
                    .type("stdoutMatches")
                    .expected(expectations.getStdoutMatches())
                    .passed(matches)
                    .build());
        }

        if (expectations.getStderrEmpty() != null && expectations.getStderrEmpty()) {
            validations.add(ParallelSuiteResultDto.ValidationItemDto.builder()
                    .type("stderrEmpty")
                    .expected(true)
                    .actual(result.getStderr().isEmpty())
                    .passed(result.getStderr().isEmpty())
                    .build());
        }

        if (expectations.getMaxDuration() != null) {
            validations.add(ParallelSuiteResultDto.ValidationItemDto.builder()
                    .type("maxDuration")
                    .expected(expectations.getMaxDuration())
                    .actual(result.getDuration())
                    .passed(result.getDuration() <= expectations.getMaxDuration())
                    .build());
        }

        return validations;
    }

    private CommandResultDto mapToDto(CommandResult result) {
        return CommandResultDto.builder()
                .exitCode(result.getExitCode())
                .stdout(result.getStdout())
                .stderr(result.getStderr())
                .duration(result.getDuration())
                .timedOut(result.isTimedOut())
                .error(result.getError())
                .build();
    }

    private ValidationResult validateResult(CommandResult result, TestSuiteRequestDto.ExpectationsDto expectations) {
        List<ValidationResult.ValidationItem> validations = new ArrayList<>();

        if (expectations == null) {
            return ValidationResult.builder().passed(true).validations(validations).build();
        }

        if (expectations.getExitCode() != null) {
            validations.add(ValidationResult.ValidationItem.builder()
                    .type("exitCode")
                    .expected(expectations.getExitCode())
                    .actual(result.getExitCode())
                    .passed(result.getExitCode() == expectations.getExitCode())
                    .build());
        }

        if (expectations.getStdoutContains() != null && !expectations.getStdoutContains().isEmpty()) {
            boolean contains = expectations.getStdoutContains().stream()
                    .allMatch(s -> result.getStdout().contains(s));
            validations.add(ValidationResult.ValidationItem.builder()
                    .type("stdoutContains")
                    .expected(expectations.getStdoutContains())
                    .passed(contains)
                    .build());
        }

        if (expectations.getStdoutMatches() != null) {
            boolean matches = Pattern.compile(expectations.getStdoutMatches()).matcher(result.getStdout()).find();
            validations.add(ValidationResult.ValidationItem.builder()
                    .type("stdoutMatches")
                    .expected(expectations.getStdoutMatches())
                    .passed(matches)
                    .build());
        }

        if (expectations.getStderrEmpty() != null && expectations.getStderrEmpty()) {
            validations.add(ValidationResult.ValidationItem.builder()
                    .type("stderrEmpty")
                    .expected(true)
                    .actual(result.getStderr().isEmpty())
                    .passed(result.getStderr().isEmpty())
                    .build());
        }

        if (expectations.getMaxDuration() != null) {
            validations.add(ValidationResult.ValidationItem.builder()
                    .type("maxDuration")
                    .expected(expectations.getMaxDuration())
                    .actual(result.getDuration())
                    .passed(result.getDuration() <= expectations.getMaxDuration())
                    .build());
        }

        boolean allPassed = validations.stream().allMatch(ValidationResult.ValidationItem::isPassed);

        return ValidationResult.builder()
                .passed(allPassed)
                .validations(validations)
                .build();
    }

    private TestSuiteResultDto.ValidationDto mapValidation(ValidationResult validation) {
        return TestSuiteResultDto.ValidationDto.builder()
                .passed(validation.isPassed())
                .validations(validation.getValidations().stream()
                        .map(v -> TestSuiteResultDto.ValidationItemDto.builder()
                                .type(v.getType())
                                .expected(v.getExpected())
                                .actual(v.getActual())
                                .passed(v.isPassed())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }
}
