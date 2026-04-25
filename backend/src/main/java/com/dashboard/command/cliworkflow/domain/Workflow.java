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
public class Workflow {
    private String name;
    private Map<String, String> env;
    private List<WorkflowStep> steps;
}
