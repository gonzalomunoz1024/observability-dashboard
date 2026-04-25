package com.dashboard.command.healthmonitor.domain.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class HealthCheckResultDto {
    private String status;
    private int servicesChecked;
}
