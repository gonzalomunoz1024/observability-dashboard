package com.dashboard.command.synthetic.adapters.outbound;

import com.dashboard.command.synthetic.domain.SyntheticRun;
import com.dashboard.command.synthetic.ports.outbound.SyntheticRunRepositoryPort;
import io.r2dbc.spi.Row;
import io.r2dbc.spi.RowMetadata;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Slf4j
@Repository
@RequiredArgsConstructor
public class R2dbcSyntheticRunAdapter implements SyntheticRunRepositoryPort {

    private final DatabaseClient databaseClient;

    @Override
    public Mono<SyntheticRun> save(SyntheticRun run) {
        return databaseClient.sql("""
                INSERT INTO synthetic_runs
                (transaction_id, status, trigger_type, started_at, finished_at, elapsed_ms, result, error)
                VALUES (:transactionId, :status, :triggerType, :startedAt, :finishedAt,
                        :elapsedMs, :result, :error)
                """)
                .bind("transactionId", run.getTransactionId())
                .bind("status", run.getStatus())
                .bind("triggerType", run.getTriggerType())
                .bind("startedAt", LocalDateTime.ofInstant(run.getStartedAt(), ZoneOffset.UTC))
                .bind("finishedAt", run.getFinishedAt() != null
                        ? LocalDateTime.ofInstant(run.getFinishedAt(), ZoneOffset.UTC)
                        : LocalDateTime.MIN)
                .bind("elapsedMs", run.getElapsedMs() != null ? run.getElapsedMs() : 0L)
                .bind("result", run.getResult() != null ? run.getResult() : "")
                .bind("error", run.getError() != null ? run.getError() : "")
                .fetch()
                .rowsUpdated()
                .flatMap(rows -> databaseClient.sql("SELECT IDENTITY() AS id")
                        .map((row, md) -> row.get("id", Long.class))
                        .one())
                .map(id -> { run.setId(id); return run; });
    }

    @Override
    public Mono<SyntheticRun> updateResult(Long id, String status, String result, String error, Long elapsedMs) {
        Instant finishedAt = Instant.now();
        return databaseClient.sql("""
                UPDATE synthetic_runs
                SET status = :status, finished_at = :finishedAt,
                    elapsed_ms = :elapsedMs, result = :result, error = :error
                WHERE id = :id
                """)
                .bind("id", id)
                .bind("status", status)
                .bind("finishedAt", LocalDateTime.ofInstant(finishedAt, ZoneOffset.UTC))
                .bind("elapsedMs", elapsedMs != null ? elapsedMs : 0L)
                .bind("result", result != null ? result : "")
                .bind("error", error != null ? error : "")
                .then()
                .then(findById(id));
    }

    @Override
    public Mono<SyntheticRun> findById(Long id) {
        return databaseClient.sql("SELECT * FROM synthetic_runs WHERE id = :id")
                .bind("id", id)
                .map(this::mapRow)
                .one();
    }

    @Override
    public Flux<SyntheticRun> findRecent(int limit) {
        return databaseClient.sql("SELECT * FROM synthetic_runs ORDER BY started_at DESC LIMIT :limit")
                .bind("limit", limit)
                .map(this::mapRow)
                .all();
    }

    @Override
    public Flux<SyntheticRun> findByTransaction(Long transactionId, int limit) {
        return databaseClient.sql("""
                SELECT * FROM synthetic_runs
                WHERE transaction_id = :transactionId
                ORDER BY started_at DESC
                LIMIT :limit
                """)
                .bind("transactionId", transactionId)
                .bind("limit", limit)
                .map(this::mapRow)
                .all();
    }

    private SyntheticRun mapRow(Row row, RowMetadata md) {
        LocalDateTime startedAt = row.get("started_at", LocalDateTime.class);
        LocalDateTime finishedAt = row.get("finished_at", LocalDateTime.class);
        Long elapsedMs = row.get("elapsed_ms", Long.class);
        String result = row.get("result", String.class);
        String error = row.get("error", String.class);

        return SyntheticRun.builder()
                .id(row.get("id", Long.class))
                .transactionId(row.get("transaction_id", Long.class))
                .status(row.get("status", String.class))
                .triggerType(row.get("trigger_type", String.class))
                .startedAt(startedAt != null ? startedAt.toInstant(ZoneOffset.UTC) : null)
                .finishedAt(finishedAt != null && !finishedAt.equals(LocalDateTime.MIN)
                        ? finishedAt.toInstant(ZoneOffset.UTC) : null)
                .elapsedMs(elapsedMs != null && elapsedMs > 0 ? elapsedMs : null)
                .result(result != null && !result.isEmpty() ? result : null)
                .error(error != null && !error.isEmpty() ? error : null)
                .build();
    }
}
