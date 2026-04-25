package com.dashboard.command.loadtest.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoadTestConfig {
    private int concurrentUsers;
    private int rampUpTime;
    private int duration;
    private Integer maxResponseTime;
    private Double maxErrorRate;
    private Integer minThroughput;
}
