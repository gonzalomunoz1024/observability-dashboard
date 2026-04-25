package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.TraceResult;
import com.dashboard.command.synthetic.domain.command.TraceEventCommand;
import reactor.core.publisher.Mono;

public interface TraceEventUseCase {
    Mono<TraceResult> execute(TraceEventCommand command);
}
