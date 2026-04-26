package com.dashboard.command.cliworkflow.dto.outbound;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowResultDto {
    private String workflowName;
    private boolean passed;
    private long duration;
    private Map<String, String> variables;
    private List<StepResultDto> steps;
    private SummaryDto summary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SummaryDto {
        private int total;
        private int passed;
        private int failed;
        private int skipped;
        private String passRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StepResultDto {
        private String id;
        private String name;
        private String type;
        private boolean passed;
        private boolean skipped;
        private String skipReason;
        // Command step results
        private int exitCode;
        private String stdout;
        private String stderr;
        private long duration;
        private boolean timedOut;
        private String error;
        // HTTP step results
        private Integer statusCode;
        private String responseBody;
        private Map<String, String> responseHeaders;
        private Integer pollAttempts;
        private Long pollDuration;
        // Captured variables
        private Map<String, String> capturedVariables;
        private List<ArtifactResultDto> artifactResults;
        private List<ValidationItemDto> validations;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ArtifactResultDto {
        private String path;
        private String varName;
        private String resolvedPath;
        private boolean exists;
        private boolean passed;
        private String error;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValidationItemDto {
        private String type;
        private Object expected;
        private Object actual;
        private boolean passed;
    }
}
