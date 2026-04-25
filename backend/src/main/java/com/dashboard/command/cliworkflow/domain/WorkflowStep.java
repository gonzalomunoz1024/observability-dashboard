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
public class WorkflowStep {
    private String id;
    private String name;

    // Step type: "command" (default) or "http"
    @Builder.Default
    private String type = "command";

    // Command step fields
    private String executable;
    private List<String> args;
    @Builder.Default
    private int timeout = 30000;
    private List<String> dependsOn;

    // Interactive input support (command only)
    private List<String> stdinInputs;
    @Builder.Default
    private int stdinDelay = 100;

    // HTTP step configuration
    private HttpConfig http;

    // Expectations (command steps)
    private StepExpectations expectations;

    // Variable capture rules
    private Map<String, CaptureRule> capture;

    // Artifact checks after execution
    private List<ArtifactCheck> artifacts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StepExpectations {
        private Integer exitCode;
        private List<String> stdoutContains;
        private String stdoutMatches;
        private Boolean stderrEmpty;
        private List<String> stderrContains;
        private Integer maxDuration;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HttpConfig {
        @Builder.Default
        private String method = "GET";
        private String url;
        private Map<String, String> headers;
        private String body;
        private HttpPolling polling;
        private HttpExpect expect;
        private Map<String, HttpCaptureRule> capture;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HttpPolling {
        @Builder.Default
        private boolean enabled = false;
        @Builder.Default
        private int intervalSeconds = 30;
        @Builder.Default
        private int maxDurationMinutes = 60;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HttpExpect {
        @Builder.Default
        private int statusCode = 200;
        private String bodyContains;
        private String jsonPath;
        private String jsonPathValue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HttpCaptureRule {
        @Builder.Default
        private String source = "body";
        private String jsonPath;
        private String regex;
    }
}
