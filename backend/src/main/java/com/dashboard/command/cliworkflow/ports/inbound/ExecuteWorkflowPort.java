package com.dashboard.command.cliworkflow.ports.inbound;

import com.dashboard.command.cliworkflow.domain.Workflow;
import com.dashboard.command.cliworkflow.domain.WorkflowResult;
import reactor.core.publisher.Mono;

public interface ExecuteWorkflowPort {
    Mono<WorkflowResult> execute(Workflow workflow);
}
