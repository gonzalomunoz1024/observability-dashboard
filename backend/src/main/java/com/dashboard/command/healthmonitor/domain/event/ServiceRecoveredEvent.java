package com.dashboard.command.healthmonitor.domain.event;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ServiceRecoveredEvent {
    private Long serviceId;
    private String serviceName;
    private String serviceUrl;
    private Instant downSince;
    private Long downDurationSeconds;
    private Instant timestamp;
}
