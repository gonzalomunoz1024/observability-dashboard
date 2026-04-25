package com.dashboard.command.cli.usecases;

import com.dashboard.command.cli.domain.CommandResult;
import com.dashboard.command.cli.domain.command.ExecuteCliCommand;
import com.dashboard.command.cli.ports.outbound.ProcessExecutorPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class DefaultExecuteCommandUseCase implements ExecuteCommandUseCase {

    private final ProcessExecutorPort processExecutorPort;

    @Override
    public Mono<CommandResult> execute(ExecuteCliCommand command) {
        return processExecutorPort.execute(
                command.getExecutable(),
                command.getArgs(),
                command.getTimeout(),
                command.getCwd(),
                command.getEnv(),
                command.getStdinInputs(),
                command.getStdinDelay()
        );
    }
}
