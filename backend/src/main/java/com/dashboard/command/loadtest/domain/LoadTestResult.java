package com.dashboard.command.loadtest.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoadTestResult {
    private boolean passed;
    private LoadTestMetrics metrics;
    private String rawOutput;
    private String error;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoadTestMetrics {
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
    public static class CriteriaResult {
        private boolean responseTimePassed;
        private boolean errorRatePassed;
        private boolean throughputPassed;
    }
}
