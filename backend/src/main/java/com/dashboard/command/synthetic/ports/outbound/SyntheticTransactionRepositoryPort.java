package com.dashboard.command.synthetic.ports.outbound;

import com.dashboard.command.synthetic.domain.SyntheticTransaction;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;

public interface SyntheticTransactionRepositoryPort {
    Mono<SyntheticTransaction> save(SyntheticTransaction tx);
    Mono<SyntheticTransaction> update(SyntheticTransaction tx);
    Mono<SyntheticTransaction> findById(Long id);
    Flux<SyntheticTransaction> findAll();
    Flux<SyntheticTransaction> findDue(Instant now);
    Mono<Void> updateRunTracking(Long id, Instant lastRunAt, Instant nextRunAt, String lastStatus);
    Mono<Void> deleteById(Long id);
}
