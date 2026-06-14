package com.dashboard.command.synthetic.adapters.outbound;

import com.dashboard.command.synthetic.domain.SyntheticTransaction;
import com.dashboard.command.synthetic.ports.outbound.SyntheticTransactionRepositoryPort;
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
public class R2dbcSyntheticTransactionAdapter implements SyntheticTransactionRepositoryPort {

    private final DatabaseClient databaseClient;

    @Override
    public Mono<SyntheticTransaction> save(SyntheticTransaction tx) {
        Instant now = Instant.now();
        tx.setCreatedAt(now);
        tx.setUpdatedAt(now);
        Instant nextRunAt = tx.isEnabled() && tx.getIntervalSeconds() != null ? now : null;
        tx.setNextRunAt(nextRunAt);

        // R2DBC pools connections, so SELECT IDENTITY() in a follow-up call can
        // land on a different connection and return nothing — use the driver's
        // returnGeneratedValues hook instead.
        return databaseClient.sql("""
                INSERT INTO synthetic_transactions
                (name, mode, config, interval_seconds, enabled, next_run_at,
                 last_run_at, last_status, created_at, updated_at)
                VALUES (:name, :mode, :config, :intervalSeconds, :enabled, :nextRunAt,
                        NULL, NULL, :createdAt, :updatedAt)
                """)
                .bind("name", tx.getName())
                .bind("mode", tx.getMode())
                .bind("config", tx.getConfig())
                .bind("intervalSeconds", tx.getIntervalSeconds() == null ? 0 : tx.getIntervalSeconds())
                .bind("enabled", tx.isEnabled())
                .bind("nextRunAt", nextRunAt != null ? LocalDateTime.ofInstant(nextRunAt, ZoneOffset.UTC) : LocalDateTime.MIN)
                .bind("createdAt", LocalDateTime.ofInstant(now, ZoneOffset.UTC))
                .bind("updatedAt", LocalDateTime.ofInstant(now, ZoneOffset.UTC))
                .filter(statement -> statement.returnGeneratedValues("id"))
                .map(row -> row.get(0, Long.class))
                .one()
                .map(id -> { tx.setId(id); return tx; });
    }

    @Override
    public Mono<SyntheticTransaction> update(SyntheticTransaction tx) {
        Instant now = Instant.now();
        tx.setUpdatedAt(now);
        Instant nextRunAt = tx.isEnabled() && tx.getIntervalSeconds() != null
                ? (tx.getNextRunAt() != null ? tx.getNextRunAt() : now)
                : null;
        tx.setNextRunAt(nextRunAt);

        return databaseClient.sql("""
                UPDATE synthetic_transactions SET
                name = :name, mode = :mode, config = :config,
                interval_seconds = :intervalSeconds, enabled = :enabled,
                next_run_at = :nextRunAt, updated_at = :updatedAt
                WHERE id = :id
                """)
                .bind("id", tx.getId())
                .bind("name", tx.getName())
                .bind("mode", tx.getMode())
                .bind("config", tx.getConfig())
                .bind("intervalSeconds", tx.getIntervalSeconds() == null ? 0 : tx.getIntervalSeconds())
                .bind("enabled", tx.isEnabled())
                .bind("nextRunAt", nextRunAt != null ? LocalDateTime.ofInstant(nextRunAt, ZoneOffset.UTC) : LocalDateTime.MIN)
                .bind("updatedAt", LocalDateTime.ofInstant(now, ZoneOffset.UTC))
                .then()
                .thenReturn(tx);
    }

    @Override
    public Mono<SyntheticTransaction> findById(Long id) {
        return databaseClient.sql("SELECT * FROM synthetic_transactions WHERE id = :id")
                .bind("id", id)
                .map(this::mapRow)
                .one();
    }

    @Override
    public Flux<SyntheticTransaction> findAll() {
        return databaseClient.sql("SELECT * FROM synthetic_transactions ORDER BY created_at DESC")
                .map(this::mapRow)
                .all();
    }

    @Override
    public Flux<SyntheticTransaction> findDue(Instant now) {
        return databaseClient.sql("""
                SELECT * FROM synthetic_transactions
                WHERE enabled = TRUE
                  AND interval_seconds > 0
                  AND next_run_at IS NOT NULL
                  AND next_run_at <= :now
                """)
                .bind("now", LocalDateTime.ofInstant(now, ZoneOffset.UTC))
                .map(this::mapRow)
                .all();
    }

    @Override
    public Mono<Void> updateRunTracking(Long id, Instant lastRunAt, Instant nextRunAt, String lastStatus) {
        return databaseClient.sql("""
                UPDATE synthetic_transactions
                SET last_run_at = :lastRunAt, next_run_at = :nextRunAt, last_status = :lastStatus
                WHERE id = :id
                """)
                .bind("id", id)
                .bind("lastRunAt", LocalDateTime.ofInstant(lastRunAt, ZoneOffset.UTC))
                .bind("nextRunAt", nextRunAt != null ? LocalDateTime.ofInstant(nextRunAt, ZoneOffset.UTC) : LocalDateTime.MIN)
                .bind("lastStatus", lastStatus != null ? lastStatus : "")
                .then();
    }

    @Override
    public Mono<Void> deleteById(Long id) {
        return databaseClient.sql("DELETE FROM synthetic_transactions WHERE id = :id")
                .bind("id", id)
                .then();
    }

    private SyntheticTransaction mapRow(Row row, RowMetadata md) {
        LocalDateTime nextRunAt = row.get("next_run_at", LocalDateTime.class);
        LocalDateTime lastRunAt = row.get("last_run_at", LocalDateTime.class);
        LocalDateTime createdAt = row.get("created_at", LocalDateTime.class);
        LocalDateTime updatedAt = row.get("updated_at", LocalDateTime.class);
        Integer interval = row.get("interval_seconds", Integer.class);
        String lastStatus = row.get("last_status", String.class);

        return SyntheticTransaction.builder()
                .id(row.get("id", Long.class))
                .name(row.get("name", String.class))
                .mode(row.get("mode", String.class))
                .config(row.get("config", String.class))
                .intervalSeconds(interval != null && interval > 0 ? interval : null)
                .enabled(Boolean.TRUE.equals(row.get("enabled", Boolean.class)))
                .nextRunAt(nextRunAt != null && !nextRunAt.equals(LocalDateTime.MIN)
                        ? nextRunAt.toInstant(ZoneOffset.UTC) : null)
                .lastRunAt(lastRunAt != null ? lastRunAt.toInstant(ZoneOffset.UTC) : null)
                .lastStatus(lastStatus != null && !lastStatus.isEmpty() ? lastStatus : null)
                .createdAt(createdAt != null ? createdAt.toInstant(ZoneOffset.UTC) : null)
                .updatedAt(updatedAt != null ? updatedAt.toInstant(ZoneOffset.UTC) : null)
                .build();
    }
}
