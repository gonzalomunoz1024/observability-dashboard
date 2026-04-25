package com.dashboard.command.cli.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

import java.util.List;
import java.util.Map;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class TestSuiteRequestDto {
    private String executable;
    private List<TestCaseDto> tests;
    private String cwd;
    private Map<String, String> env;

    @Data
    @Builder
    @Jacksonized
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestCaseDto {
        private String name;
        @Builder.Default
        private List<String> args = List.of();
        @Builder.Default
        private int timeout = 30000;
        private ExpectationsDto expectations;
        // Interactive stdin support
        private List<String> stdinInputs;
        @Builder.Default
        private int stdinDelay = 100;
    }

    @Data
    @Builder
    @Jacksonized
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ExpectationsDto {
        private Integer exitCode;
        private List<String> stdoutContains;
        private String stdoutMatches;
        private Boolean stderrEmpty;
        private Integer maxDuration;
    }
}
