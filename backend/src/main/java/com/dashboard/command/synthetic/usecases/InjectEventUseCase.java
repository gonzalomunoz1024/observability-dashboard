package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.domain.command.InjectEventCommand;
import reactor.core.publisher.Mono;

public interface InjectEventUseCase {
    Mono<SyntheticEvent> execute(InjectEventCommand command);
}
