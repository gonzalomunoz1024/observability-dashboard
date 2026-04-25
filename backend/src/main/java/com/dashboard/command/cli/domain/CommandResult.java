package com.dashboard.command.cli.domain;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CommandResult {
    private int exitCode;
    private String stdout;
    private String stderr;
    private long duration;
    private boolean timedOut;
    private String error;
}
