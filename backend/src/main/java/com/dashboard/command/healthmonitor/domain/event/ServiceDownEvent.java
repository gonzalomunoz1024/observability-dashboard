package com.dashboard.command.healthmonitor.domain.event;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ServiceDownEvent {
    private Long serviceId;
    private String serviceName;
    private String serviceUrl;
    private int consecutiveFailures;
    private String errorMessage;
    private Instant timestamp;
}
