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
public class WorkflowResult {
    private String workflowName;
    private boolean passed;
    private long duration;
    private Map<String, String> variables;
    private List<StepResult> steps;
}
