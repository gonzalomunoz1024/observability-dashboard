package com.dashboard.command.loadtest.ports.inbound;

import com.dashboard.command.loadtest.domain.LoadTestConfig;
import com.dashboard.command.loadtest.domain.LoadTestResult;
import reactor.core.publisher.Mono;

public interface RunLoadTestPort {
    Mono<LoadTestResult> runTest(String scriptContent, String scriptFilename, LoadTestConfig config);
}
