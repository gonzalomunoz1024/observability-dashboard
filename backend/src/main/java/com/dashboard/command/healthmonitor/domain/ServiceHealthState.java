package com.dashboard.command.healthmonitor.domain;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;

@Data
@Builder
@Table("service_health_states")
public class ServiceHealthState {
    @Id
    private Long id;

    @Column("service_id")
    private Long serviceId;

    @Column("consecutive_failures")
    @Builder.Default
    private int consecutiveFailures = 0;

    @Column("alert_sent")
    @Builder.Default
    private boolean alertSent = false;

    @Column("last_check_time")
    private Instant lastCheckTime;

    @Column("last_success_time")
    private Instant lastSuccessTime;

    @Column("last_failure_time")
    private Instant lastFailureTime;

    @Column("alert_sent_time")
    private Instant alertSentTime;

    @Column("last_error")
    private String lastError;

    @Column("current_status")
    @Builder.Default
    private String currentStatus = "unknown";
}
