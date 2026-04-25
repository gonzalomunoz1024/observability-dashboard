package com.dashboard.command.cliworkflow.ports.outbound;

import com.dashboard.command.cliworkflow.domain.ArtifactCheck;
import com.dashboard.command.cliworkflow.domain.ArtifactResult;
import reactor.core.publisher.Mono;

public interface ArtifactVerifierPort {
    Mono<ArtifactResult> verify(ArtifactCheck check, String resolvedPath);
}
