package com.dashboard.command.healthmonitor.domain;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;

@Data
@Builder
@Table("monitored_services")
public class MonitoredService {
    @Id
    private Long id;

    private String name;

    private String url;

    @Builder.Default
    private String method = "GET";

    @Builder.Default
    private int timeout = 5000;

    @Column("expected_status")
    @Builder.Default
    private int expectedStatus = 200;

    @Column("check_interval_seconds")
    @Builder.Default
    private int checkIntervalSeconds = 60;

    @Builder.Default
    private boolean enabled = true;

    @Column("alert_recipients")
    private String alertRecipients;

    @Column("created_at")
    private Instant createdAt;

    @Column("updated_at")
    private Instant updatedAt;
}
