package com.dashboard.command.synthetic.domain;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TraceResult {
    private String correlationId;
    private List<String> expectedFlow;
    private List<SyntheticEvent> foundEvents;
    private List<String> completedSteps;
    private List<String> missingSteps;
    private String status;
    private long elapsedTime;
}
