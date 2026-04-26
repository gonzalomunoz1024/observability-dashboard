package com.dashboard.command.cliworkflow.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.jackson.Jacksonized;

import java.util.List;
import java.util.Map;

@Data
@Builder
@Jacksonized
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class WorkflowRequestDto {
    private String name;
    private Map<String, String> env;
    private List<StepDto> steps;

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StepDto {
        private String id;
        private String name;

        // Step type: "command" (default) or "http"
        @Builder.Default
        private String type = "command";

        // Command step fields
        private String executable;
        @Builder.Default
        private List<String> args = List.of();
        @Builder.Default
        private int timeout = 30000;
        private List<String> dependsOn;

        // Interactive input
        private List<String> stdinInputs;
        @Builder.Default
        private int stdinDelay = 100;

        // HTTP step configuration
        private HttpConfigDto http;

        // Expectations
        private ExpectationsDto expectations;

        // Variable capture
        private Map<String, CaptureRuleDto> capture;

        // Artifacts to verify
        private List<ArtifactCheckDto> artifacts;
    }

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class HttpConfigDto {
        @Builder.Default
        private String method = "GET";
        private String url;
        private Map<String, String> headers;
        private String body;
        private HttpPollingDto polling;
        private HttpExpectDto expect;
        private Map<String, HttpCaptureRuleDto> capture;
    }

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class HttpPollingDto {
        @Builder.Default
        private boolean enabled = false;
        @Builder.Default
        private int intervalSeconds = 30;
        @Builder.Default
        private int maxDurationMinutes = 60;
    }

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class HttpExpectDto {
        @Builder.Default
        private int statusCode = 200;
        private String bodyContains;
        private String jsonPath;
        private String jsonPathValue;
    }

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class HttpCaptureRuleDto {
        @Builder.Default
        private String source = "body";
        private String jsonPath;
        private String regex;
    }

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ExpectationsDto {
        private Integer exitCode;
        private List<String> stdoutContains;
        private String stdoutMatches;
        private Boolean stderrEmpty;
        private List<String> stderrContains;
        private Integer maxDuration;
    }

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CaptureRuleDto {
        @Builder.Default
        private String source = "stdout";
        private String regex;
    }

    @Data
    @Builder
    @Jacksonized
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ArtifactCheckDto {
        private String varName;  // Optional: captures resolved path as variable
        private String path;
        @Builder.Default
        private boolean exists = true;
        private List<String> contains;
        private boolean yamlValid;
        private boolean jsonValid;
        private boolean isDirectory;  // Validate as directory instead of file
    }
}
