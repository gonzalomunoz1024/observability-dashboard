package com.dashboard.command.loadtest.domain.dto.inbound;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoadTestRequestDto {

    @NotNull(message = "Script content is required")
    private String scriptContent;

    @NotNull(message = "Script filename is required")
    private String scriptFilename;

    @Min(value = 1, message = "Concurrent users must be at least 1")
    private int concurrentUsers;

    @Min(value = 0, message = "Ramp up time cannot be negative")
    private int rampUpTime;

    @Min(value = 1, message = "Duration must be at least 1 second")
    private int duration;

    private Integer maxResponseTime;
    private Double maxErrorRate;
    private Integer minThroughput;
}
