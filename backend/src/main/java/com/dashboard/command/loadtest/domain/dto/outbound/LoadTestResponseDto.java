package com.dashboard.command.loadtest.domain.dto.outbound;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoadTestResponseDto {
    private boolean passed;
    private Metrics metrics;
    private Criteria criteria;
    private String error;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Metrics {
        private int totalRequests;
        private int successfulRequests;
        private int failedRequests;
        private double avgResponseTime;
        private double minResponseTime;
        private double maxResponseTime;
        private double p90ResponseTime;
        private double p95ResponseTime;
        private double p99ResponseTime;
        private double errorRate;
        private double throughput;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Criteria {
        private Boolean responseTimePassed;
        private Boolean errorRatePassed;
        private Boolean throughputPassed;
    }
}
