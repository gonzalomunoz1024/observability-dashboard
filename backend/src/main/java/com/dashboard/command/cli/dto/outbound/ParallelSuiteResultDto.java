package com.dashboard.command.cli.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

import java.util.List;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class ParallelSuiteResultDto {
    private String suiteName;
    private boolean passed;
    private int totalTests;
    private int passedCount;
    private int failedCount;
    private long duration;
    private List<TestResultDto> results;

    @Data
    @Builder
    @Jacksonized
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestResultDto {
        private String id;
        private String name;
        private String executable;
        private List<String> args;
        private boolean passed;
        private int exitCode;
        private String stdout;
        private String stderr;
        private long duration;
        private boolean timedOut;
        private List<ValidationItemDto> validations;
    }

    @Data
    @Builder
    @Jacksonized
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ValidationItemDto {
        private String type;
        private Object expected;
        private Object actual;
        private boolean passed;
    }
}
