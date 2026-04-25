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
public class ExecuteRequestDto {
    private String executable;
    @Builder.Default
    private List<String> args = List.of();
    @Builder.Default
    private int timeout = 30000;
    private String cwd;
    private Map<String, String> env;
    // Interactive stdin support
    private List<String> stdinInputs;
    @Builder.Default
    private int stdinDelay = 100; // ms between inputs
}
