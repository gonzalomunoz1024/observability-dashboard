package com.dashboard.command.healthmonitor.domain.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class MonitoredServiceResponseDto {
    private Long id;
    private String name;
    private String url;
    private String method;
    private int timeout;
    private int expectedStatus;
    private int checkIntervalSeconds;
    private boolean enabled;
    private List<String> alertRecipients;
    private Instant createdAt;
    private Instant updatedAt;
}
