package com.dashboard.command.cli.usecases;

import com.dashboard.command.cli.domain.CommandResult;
import com.dashboard.command.cli.domain.command.ExecuteCliCommand;
import reactor.core.publisher.Mono;

public interface ExecuteCommandUseCase {
    Mono<CommandResult> execute(ExecuteCliCommand command);
}
