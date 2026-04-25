package com.dashboard.command.cli.ports.outbound;

import com.dashboard.command.cli.domain.CommandResult;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

public interface ProcessExecutorPort {
    Mono<CommandResult> execute(String executable, List<String> args, int timeout, String cwd, Map<String, String> env);

    Mono<CommandResult> execute(String executable, List<String> args, int timeout, String cwd, Map<String, String> env,
                                 List<String> stdinInputs, int stdinDelay);
}
