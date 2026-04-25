package com.dashboard.command.health.domain;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HealthStatus {
    private String status;
    private Integer statusCode;
    private Long responseTime;
    private String error;
}
