package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.RestCheckResult;
import com.dashboard.command.synthetic.domain.command.RestInjectCommand;
import reactor.core.publisher.Mono;

public interface RestInjectAndCheckUseCase {
    Mono<RestCheckResult> execute(RestInjectCommand command);
}
