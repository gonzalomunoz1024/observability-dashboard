package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.SyntheticRun;
import com.dashboard.command.synthetic.domain.SyntheticTransaction;
import reactor.core.publisher.Mono;

public interface RunSyntheticTransactionUseCase {
    Mono<SyntheticRun> run(SyntheticTransaction tx, String triggerType);
}
