package com.dashboard.command.loadtest.adapters.inbound;

import com.dashboard.command.loadtest.domain.LoadTestConfig;
import com.dashboard.command.loadtest.domain.dto.inbound.LoadTestRequestDto;
import com.dashboard.command.loadtest.domain.dto.outbound.LoadTestResponseDto;
import com.dashboard.command.loadtest.ports.inbound.RunLoadTestPort;
import com.dashboard.command.loadtest.ports.outbound.JMeterExecutorPort;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/loadtest")
@RequiredArgsConstructor
public class RestControllerLoadTestInboundAdapter {

    private final RunLoadTestPort runLoadTestPort;
    private final JMeterExecutorPort jmeterExecutor;

    @GetMapping("/check")
    public Mono<ResponseEntity<Map<String, Object>>> checkJMeterAvailable() {
        boolean available = jmeterExecutor.isJMeterAvailable();
        return Mono.just(ResponseEntity.ok(Map.of(
                "available", available,
                "message", available ? "JMeter is available" : "JMeter is not available"
        )));
    }

    @PostMapping("/run")
    public Mono<ResponseEntity<LoadTestResponseDto>> runLoadTest(
            @Valid @RequestBody LoadTestRequestDto request) {
        log.info("Received load test request for script: {}", request.getScriptFilename());

        LoadTestConfig config = LoadTestConfig.builder()
                .concurrentUsers(request.getConcurrentUsers())
                .rampUpTime(request.getRampUpTime())
                .duration(request.getDuration())
                .maxResponseTime(request.getMaxResponseTime())
                .maxErrorRate(request.getMaxErrorRate())
                .minThroughput(request.getMinThroughput())
                .build();

        return runLoadTestPort.runTest(request.getScriptContent(), request.getScriptFilename(), config)
                .map(result -> {
                    LoadTestResponseDto.Metrics metrics = null;
                    LoadTestResponseDto.Criteria criteria = null;

                    if (result.getMetrics() != null) {
                        var m = result.getMetrics();
                        metrics = LoadTestResponseDto.Metrics.builder()
                                .totalRequests(m.getTotalRequests())
                                .successfulRequests(m.getSuccessfulRequests())
                                .failedRequests(m.getFailedRequests())
                                .avgResponseTime(m.getAvgResponseTime())
                                .minResponseTime(m.getMinResponseTime())
                                .maxResponseTime(m.getMaxResponseTime())
                                .p90ResponseTime(m.getP90ResponseTime())
                                .p95ResponseTime(m.getP95ResponseTime())
                                .p99ResponseTime(m.getP99ResponseTime())
                                .errorRate(m.getErrorRate())
                                .throughput(m.getThroughput())
                                .build();

                        criteria = LoadTestResponseDto.Criteria.builder()
                                .responseTimePassed(config.getMaxResponseTime() == null ||
                                        m.getAvgResponseTime() <= config.getMaxResponseTime())
                                .errorRatePassed(config.getMaxErrorRate() == null ||
                                        m.getErrorRate() <= config.getMaxErrorRate())
                                .throughputPassed(config.getMinThroughput() == null ||
                                        m.getThroughput() >= config.getMinThroughput())
                                .build();
                    }

                    return ResponseEntity.ok(LoadTestResponseDto.builder()
                            .passed(result.isPassed())
                            .metrics(metrics)
                            .criteria(criteria)
                            .error(result.getError())
                            .build());
                });
    }
}
