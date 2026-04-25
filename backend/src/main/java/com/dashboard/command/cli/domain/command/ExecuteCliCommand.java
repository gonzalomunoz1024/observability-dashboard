package com.dashboard.command.cli.domain.command;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class ExecuteCliCommand {
    private String executable;
    private List<String> args;
    @Builder.Default
    private int timeout = 30000;
    private String cwd;
    private Map<String, String> env;
    // Interactive stdin support
    private List<String> stdinInputs;
    @Builder.Default
    private int stdinDelay = 100; // ms between inputs
}
