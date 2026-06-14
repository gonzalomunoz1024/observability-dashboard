package com.dashboard.core.cron;

import com.dashboard.command.synthetic.ports.outbound.SyntheticTransactionRepositoryPort;
import com.dashboard.command.synthetic.usecases.RunSyntheticTransactionUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(value = "synthetic.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class SyntheticTransactionScheduler {

    private final SyntheticTransactionRepositoryPort txRepository;
    private final RunSyntheticTransactionUseCase runUseCase;

    @Scheduled(
            initialDelayString = "${synthetic.scheduler.initial-delay:15000}",
            fixedRateString = "${synthetic.scheduler.fixed-rate:10000}"
    )
    public void runDue() {
        Instant now = Instant.now();
        txRepository.findDue(now)
                .flatMap(tx -> {
                    // Claim the next slot synchronously so the next 10-second
                    // tick doesn't see this transaction as still due and
                    // re-fire it while the current run is still in flight.
                    Instant nextRunAt = tx.getIntervalSeconds() != null
                            ? Instant.now().plusSeconds(tx.getIntervalSeconds())
                            : null;
                    return txRepository.updateNextRunAt(tx.getId(), nextRunAt)
                            .then(runUseCase.run(tx, "scheduled"))
                            .flatMap(run -> txRepository.updateRunTracking(
                                    tx.getId(), run.getStartedAt(), nextRunAt, run.getStatus())
                                    .thenReturn(run))
                            .onErrorResume(e -> {
                                log.error("Scheduled run failed for tx {}: {}", tx.getId(), e.getMessage());
                                return reactor.core.publisher.Mono.empty();
                            });
                })
                .subscribe();
    }
}
