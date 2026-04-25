package com.dashboard.command.loadtest.usecases;

import com.dashboard.command.loadtest.domain.LoadTestConfig;
import com.dashboard.command.loadtest.domain.LoadTestResult;
import com.dashboard.command.loadtest.ports.inbound.RunLoadTestPort;
import com.dashboard.command.loadtest.ports.outbound.JMeterExecutorPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultRunLoadTestUseCase implements RunLoadTestPort {

    private final JMeterExecutorPort jmeterExecutor;

    @Override
    public Mono<LoadTestResult> runTest(String scriptContent, String scriptFilename, LoadTestConfig config) {
        return Mono.fromCallable(() -> {
            Path tempDir = Files.createTempDirectory("jmeter-test");
            Path scriptPath = tempDir.resolve(scriptFilename);
            Files.writeString(scriptPath, scriptContent);
            return scriptPath;
        }).flatMap(scriptPath -> jmeterExecutor.execute(scriptPath, config)
                .doFinally(signal -> cleanupTempFiles(scriptPath)));
    }

    private void cleanupTempFiles(Path scriptPath) {
        try {
            Files.deleteIfExists(scriptPath);
            Files.deleteIfExists(scriptPath.getParent());
        } catch (IOException e) {
            log.warn("Failed to cleanup temp files: {}", e.getMessage());
        }
    }
}
