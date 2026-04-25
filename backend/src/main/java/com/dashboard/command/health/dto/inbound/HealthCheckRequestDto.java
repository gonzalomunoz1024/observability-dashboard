package com.dashboard.command.health.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class HealthCheckRequestDto {
    private String url;
    @Builder.Default
    private String method = "GET";
    @Builder.Default
    private int timeout = 5000;
    @Builder.Default
    private int expectedStatus = 200;
}
