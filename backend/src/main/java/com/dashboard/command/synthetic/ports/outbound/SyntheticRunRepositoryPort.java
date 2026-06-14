package com.dashboard.command.synthetic.ports.outbound;

import com.dashboard.command.synthetic.domain.SyntheticRun;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface SyntheticRunRepositoryPort {
    Mono<SyntheticRun> save(SyntheticRun run);
    Mono<SyntheticRun> updateResult(Long id, String status, String result, String error, Long elapsedMs);
    Mono<SyntheticRun> findById(Long id);
    Flux<SyntheticRun> findRecent(int limit);
    Flux<SyntheticRun> findByTransaction(Long transactionId, int limit);
}
