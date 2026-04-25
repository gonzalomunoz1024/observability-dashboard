package com.dashboard.command.healthmonitor.adapters.outbound;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.ports.outbound.MonitoredServiceRepositoryPort;
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
public class R2dbcMonitoredServiceAdapter implements MonitoredServiceRepositoryPort {

    private final DatabaseClient databaseClient;

    @Override
    public Mono<MonitoredService> save(MonitoredService service) {
        return databaseClient.sql("""
                INSERT INTO monitored_services
                (name, url, method, timeout, expected_status, check_interval_seconds,
                 enabled, alert_recipients, created_at, updated_at)
                VALUES (:name, :url, :method, :timeout, :expectedStatus, :checkIntervalSeconds,
                        :enabled, :alertRecipients, :createdAt, :updatedAt)
                """)
                .bind("name", service.getName())
                .bind("url", service.getUrl())
                .bind("method", service.getMethod())
                .bind("timeout", service.getTimeout())
                .bind("expectedStatus", service.getExpectedStatus())
                .bind("checkIntervalSeconds", service.getCheckIntervalSeconds())
                .bind("enabled", service.isEnabled())
                .bind("alertRecipients", service.getAlertRecipients() != null ? service.getAlertRecipients() : "")
                .bind("createdAt", LocalDateTime.ofInstant(service.getCreatedAt(), ZoneOffset.UTC))
                .bind("updatedAt", LocalDateTime.ofInstant(service.getUpdatedAt(), ZoneOffset.UTC))
                .fetch()
                .rowsUpdated()
                .flatMap(rowsUpdated -> databaseClient.sql("SELECT IDENTITY() AS id")
                        .map((row, metadata) -> row.get("id", Long.class))
                        .one())
                .map(id -> {
                    service.setId(id);
                    return service;
                })
                .doOnSuccess(s -> log.debug("Saved monitored service with id: {}", s.getId()));
    }

    @Override
    public Mono<MonitoredService> findById(Long id) {
        return databaseClient.sql("SELECT * FROM monitored_services WHERE id = :id")
                .bind("id", id)
                .map(this::mapToService)
                .one();
    }

    @Override
    public Flux<MonitoredService> findAllEnabled() {
        return databaseClient.sql("SELECT * FROM monitored_services WHERE enabled = true")
                .map(this::mapToService)
                .all();
    }

    @Override
    public Flux<MonitoredService> findAll() {
        return databaseClient.sql("SELECT * FROM monitored_services ORDER BY created_at DESC")
                .map(this::mapToService)
                .all();
    }

    @Override
    public Mono<Void> deleteById(Long id) {
        return databaseClient.sql("DELETE FROM monitored_services WHERE id = :id")
                .bind("id", id)
                .then()
                .doOnSuccess(v -> log.debug("Deleted monitored service with id: {}", id));
    }

    @Override
    public Mono<MonitoredService> update(MonitoredService service) {
        return databaseClient.sql("""
                UPDATE monitored_services SET
                name = :name, url = :url, method = :method, timeout = :timeout,
                expected_status = :expectedStatus, check_interval_seconds = :checkIntervalSeconds,
                enabled = :enabled, alert_recipients = :alertRecipients, updated_at = :updatedAt
                WHERE id = :id
                """)
                .bind("id", service.getId())
                .bind("name", service.getName())
                .bind("url", service.getUrl())
                .bind("method", service.getMethod())
                .bind("timeout", service.getTimeout())
                .bind("expectedStatus", service.getExpectedStatus())
                .bind("checkIntervalSeconds", service.getCheckIntervalSeconds())
                .bind("enabled", service.isEnabled())
                .bind("alertRecipients", service.getAlertRecipients() != null ? service.getAlertRecipients() : "")
                .bind("updatedAt", LocalDateTime.now(ZoneOffset.UTC))
                .then()
                .thenReturn(service)
                .doOnSuccess(s -> log.debug("Updated monitored service with id: {}", s.getId()));
    }

    private MonitoredService mapToService(Row row, RowMetadata metadata) {
        LocalDateTime createdAt = row.get("created_at", LocalDateTime.class);
        LocalDateTime updatedAt = row.get("updated_at", LocalDateTime.class);

        return MonitoredService.builder()
                .id(row.get("id", Long.class))
                .name(row.get("name", String.class))
                .url(row.get("url", String.class))
                .method(row.get("method", String.class))
                .timeout(row.get("timeout", Integer.class))
                .expectedStatus(row.get("expected_status", Integer.class))
                .checkIntervalSeconds(row.get("check_interval_seconds", Integer.class))
                .enabled(row.get("enabled", Boolean.class))
                .alertRecipients(row.get("alert_recipients", String.class))
                .createdAt(createdAt != null ? createdAt.toInstant(ZoneOffset.UTC) : null)
                .updatedAt(updatedAt != null ? updatedAt.toInstant(ZoneOffset.UTC) : null)
                .build();
    }
}
