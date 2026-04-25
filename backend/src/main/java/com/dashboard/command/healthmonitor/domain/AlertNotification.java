package com.dashboard.command.healthmonitor.domain;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class AlertNotification {

    public enum AlertType {
        SERVICE_DOWN,
        SERVICE_RECOVERED
    }

    private AlertType alertType;
    private String serviceName;
    private String serviceUrl;
    private int consecutiveFailures;
    private String errorMessage;
    private Instant timestamp;
    private List<String> recipients;
    private Instant downSince;
    private Long downDurationSeconds;
}
