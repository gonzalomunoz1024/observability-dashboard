package com.dashboard.command.health.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class HealthCheckResponseDto {
    private String status;
    private Integer statusCode;
    private Long responseTime;
    private String error;
}
