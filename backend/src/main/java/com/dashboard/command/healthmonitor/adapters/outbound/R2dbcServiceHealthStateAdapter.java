package com.dashboard.command.healthmonitor.adapters.outbound;

import com.dashboard.command.healthmonitor.domain.ServiceHealthState;
import com.dashboard.command.healthmonitor.ports.outbound.ServiceHealthStateRepositoryPort;
import io.r2dbc.spi.Row;
import io.r2dbc.spi.RowMetadata;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Slf4j
@Repository
@RequiredArgsConstructor
public class R2dbcServiceHealthStateAdapter implements ServiceHealthStateRepositoryPort {

    private final DatabaseClient databaseClient;

    @Override
    public Mono<ServiceHealthState> findByServiceId(Long serviceId) {
        return databaseClient.sql("SELECT * FROM service_health_states WHERE service_id = :serviceId")
                .bind("serviceId", serviceId)
                .map(this::mapToState)
                .one();
    }

    @Override
    public Mono<ServiceHealthState> save(ServiceHealthState state) {
        if (state.getId() != null) {
            return update(state);
        }

        return databaseClient.sql("""
                INSERT INTO service_health_states
                (service_id, consecutive_failures, alert_sent, last_check_time,
                 last_success_time, last_failure_time, alert_sent_time, last_error, current_status)
                VALUES (:serviceId, :consecutiveFailures, :alertSent, :lastCheckTime,
                        :lastSuccessTime, :lastFailureTime, :alertSentTime, :lastError, :currentStatus)
                """)
                .bind("serviceId", state.getServiceId())
                .bind("consecutiveFailures", state.getConsecutiveFailures())
                .bind("alertSent", state.isAlertSent())
                .bindNull("lastCheckTime", LocalDateTime.class)
                .bindNull("lastSuccessTime", LocalDateTime.class)
                .bindNull("lastFailureTime", LocalDateTime.class)
                .bindNull("alertSentTime", LocalDateTime.class)
                .bind("lastError", state.getLastError() != null ? state.getLastError() : "")
                .bind("currentStatus", state.getCurrentStatus())
                .fetch()
                .rowsUpdated()
                .flatMap(rowsUpdated -> databaseClient.sql("SELECT IDENTITY() AS id")
                        .map((row, metadata) -> row.get("id", Long.class))
                        .one())
                .map(id -> {
                    state.setId(id);
                    return state;
                })
                .doOnSuccess(s -> log.debug("Saved health state for service id: {}", s.getServiceId()));
    }

    private Mono<ServiceHealthState> update(ServiceHealthState state) {
        return databaseClient.sql("""
                UPDATE service_health_states SET
                consecutive_failures = :consecutiveFailures,
                alert_sent = :alertSent,
                last_check_time = :lastCheckTime,
                last_success_time = :lastSuccessTime,
                last_failure_time = :lastFailureTime,
                alert_sent_time = :alertSentTime,
                last_error = :lastError,
                current_status = :currentStatus
                WHERE id = :id
                """)
                .bind("id", state.getId())
                .bind("consecutiveFailures", state.getConsecutiveFailures())
                .bind("alertSent", state.isAlertSent())
                .bind("lastCheckTime", toLocalDateTime(state.getLastCheckTime()))
                .bind("lastSuccessTime", toLocalDateTime(state.getLastSuccessTime()))
                .bind("lastFailureTime", toLocalDateTime(state.getLastFailureTime()))
                .bind("alertSentTime", toLocalDateTime(state.getAlertSentTime()))
                .bind("lastError", state.getLastError() != null ? state.getLastError() : "")
                .bind("currentStatus", state.getCurrentStatus())
                .then()
                .thenReturn(state)
                .doOnSuccess(s -> log.debug("Updated health state for service id: {}", s.getServiceId()));
    }

    @Override
    public Mono<Void> deleteByServiceId(Long serviceId) {
        return databaseClient.sql("DELETE FROM service_health_states WHERE service_id = :serviceId")
                .bind("serviceId", serviceId)
                .then()
                .doOnSuccess(v -> log.debug("Deleted health state for service id: {}", serviceId));
    }

    private ServiceHealthState mapToState(Row row, RowMetadata metadata) {
        return ServiceHealthState.builder()
                .id(row.get("id", Long.class))
                .serviceId(row.get("service_id", Long.class))
                .consecutiveFailures(row.get("consecutive_failures", Integer.class))
                .alertSent(row.get("alert_sent", Boolean.class))
                .lastCheckTime(toInstant(row.get("last_check_time", LocalDateTime.class)))
                .lastSuccessTime(toInstant(row.get("last_success_time", LocalDateTime.class)))
                .lastFailureTime(toInstant(row.get("last_failure_time", LocalDateTime.class)))
                .alertSentTime(toInstant(row.get("alert_sent_time", LocalDateTime.class)))
                .lastError(row.get("last_error", String.class))
                .currentStatus(row.get("current_status", String.class))
                .build();
    }

    private LocalDateTime toLocalDateTime(Instant instant) {
        return instant != null ? LocalDateTime.ofInstant(instant, ZoneOffset.UTC) : null;
    }

    private Instant toInstant(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.toInstant(ZoneOffset.UTC) : null;
    }
}
