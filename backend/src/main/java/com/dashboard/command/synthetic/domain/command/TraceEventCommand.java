package com.dashboard.command.synthetic.domain.command;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TraceEventCommand {
    private String correlationId;
    private String expectedFlow;
    private String index;
    @Builder.Default
    private long timeout = 30000;
}
