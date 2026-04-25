package com.dashboard.command.cli.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class TestSuiteResultDto {
    private SummaryDto summary;
    private List<TestResultDto> results;

    @Data
    @Builder
    public static class SummaryDto {
        private int total;
        private int passed;
        private int failed;
        private String passRate;
    }

    @Data
    @Builder
    public static class TestResultDto {
        private String name;
        private List<String> args;
        private int exitCode;
        private String stdout;
        private String stderr;
        private long duration;
        private boolean timedOut;
        private ValidationDto validation;
    }

    @Data
    @Builder
    public static class ValidationDto {
        private boolean passed;
        private List<ValidationItemDto> validations;
    }

    @Data
    @Builder
    public static class ValidationItemDto {
        private String type;
        private Object expected;
        private Object actual;
        private boolean passed;
    }
}
