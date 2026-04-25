package com.dashboard.command.cliworkflow.domain;

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
public class StepResult {
    private String id;
    private String name;
    @Builder.Default
    private String type = "command";
    private boolean passed;
    private boolean skipped;
    private String skipReason;

    // Command execution results
    private int exitCode;
    private String stdout;
    private String stderr;
    private long duration;
    private boolean timedOut;
    private String error;

    // HTTP execution results
    private Integer statusCode;
    private String responseBody;
    private Map<String, String> responseHeaders;
    private Integer pollAttempts;
    private Long pollDuration;

    // Captured variables
    private Map<String, String> capturedVariables;

    // Artifact check results
    private List<ArtifactResult> artifactResults;

    // Validation details
    private List<ValidationItem> validations;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValidationItem {
        private String type;
        private Object expected;
        private Object actual;
        private boolean passed;
    }
}
