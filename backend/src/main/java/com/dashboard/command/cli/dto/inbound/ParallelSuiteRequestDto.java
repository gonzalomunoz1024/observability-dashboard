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
public class ParallelSuiteRequestDto {
    private String name;
    private List<TestDto> tests;

    @Data
    @Builder
    @Jacksonized
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestDto {
        private String id;
        private String name;
        private String executable;
        @Builder.Default
        private List<String> args = List.of();
        private String cwd;
        private Map<String, String> env;
        @Builder.Default
        private int timeout = 30000;
        private ExpectationsDto expectations;
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
