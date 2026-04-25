package com.dashboard.command.loadtest.ports.outbound;

import com.dashboard.command.loadtest.domain.LoadTestConfig;
import com.dashboard.command.loadtest.domain.LoadTestResult;
import reactor.core.publisher.Mono;

import java.nio.file.Path;

public interface JMeterExecutorPort {
    Mono<LoadTestResult> execute(Path scriptPath, LoadTestConfig config);
    boolean isJMeterAvailable();
}
