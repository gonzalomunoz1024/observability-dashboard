package com.dashboard.command.cli.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class CommandResultDto {
    private int exitCode;
    private String stdout;
    private String stderr;
    private long duration;
    private boolean timedOut;
    private String error;
}
