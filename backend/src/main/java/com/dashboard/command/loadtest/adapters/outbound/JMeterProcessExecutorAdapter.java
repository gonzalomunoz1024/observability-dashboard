package com.dashboard.command.loadtest.adapters.outbound;

import com.dashboard.command.loadtest.domain.LoadTestConfig;
import com.dashboard.command.loadtest.domain.LoadTestResult;
import com.dashboard.command.loadtest.ports.outbound.JMeterExecutorPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class JMeterProcessExecutorAdapter implements JMeterExecutorPort {

    private static final Pattern SUMMARY_PATTERN = Pattern.compile(
            "summary\\s*=\\s*(\\d+)\\s+in\\s+[\\d.]+s\\s*=\\s*([\\d.]+)/s.*Err:\\s*(\\d+)");

    @Override
    public Mono<LoadTestResult> execute(Path scriptPath, LoadTestConfig config) {
        return Mono.fromCallable(() -> {
            if (!isJMeterAvailable()) {
                return LoadTestResult.builder()
                        .passed(false)
                        .error("JMeter is not available. Please install JMeter and ensure it's in the PATH.")
                        .build();
            }

            Path resultsPath = scriptPath.getParent().resolve("results.jtl");

            List<String> command = buildJMeterCommand(scriptPath, resultsPath, config);
            log.info("Executing JMeter command: {}", String.join(" ", command));

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                    log.debug("JMeter: {}", line);
                }
            }

            int exitCode = process.waitFor();
            String rawOutput = output.toString();

            if (exitCode != 0 && !rawOutput.contains("summary")) {
                return LoadTestResult.builder()
                        .passed(false)
                        .error("JMeter exited with code " + exitCode + "\n" + rawOutput)
                        .rawOutput(rawOutput)
                        .build();
            }

            LoadTestResult.LoadTestMetrics metrics = parseJMeterOutput(rawOutput, resultsPath);
            boolean passed = evaluateCriteria(metrics, config);

            return LoadTestResult.builder()
                    .passed(passed)
                    .metrics(metrics)
                    .rawOutput(rawOutput)
                    .build();

        }).subscribeOn(Schedulers.boundedElastic());
    }

    @Override
    public boolean isJMeterAvailable() {
        try {
            ProcessBuilder pb = new ProcessBuilder("jmeter", "--version");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            int exitCode = process.waitFor();
            return exitCode == 0;
        } catch (Exception e) {
            log.debug("JMeter not available: {}", e.getMessage());
            return false;
        }
    }

    private List<String> buildJMeterCommand(Path scriptPath, Path resultsPath, LoadTestConfig config) {
        List<String> command = new ArrayList<>();
        command.add("jmeter");
        command.add("-n");
        command.add("-t");
        command.add(scriptPath.toString());
        command.add("-l");
        command.add(resultsPath.toString());
        command.add("-Jthreads=" + config.getConcurrentUsers());
        command.add("-Jrampup=" + config.getRampUpTime());
        command.add("-Jduration=" + config.getDuration());
        return command;
    }

    private LoadTestResult.LoadTestMetrics parseJMeterOutput(String output, Path resultsPath) {
        int totalRequests = 0;
        int failedRequests = 0;
        double throughput = 0;

        Matcher matcher = SUMMARY_PATTERN.matcher(output);
        while (matcher.find()) {
            totalRequests = Integer.parseInt(matcher.group(1));
            throughput = Double.parseDouble(matcher.group(2));
            failedRequests = Integer.parseInt(matcher.group(3));
        }

        double avgResponseTime = 0;
        double minResponseTime = Double.MAX_VALUE;
        double maxResponseTime = 0;
        List<Double> responseTimes = new ArrayList<>();

        if (Files.exists(resultsPath)) {
            try {
                List<String> lines = Files.readAllLines(resultsPath);
                for (int i = 1; i < lines.size(); i++) {
                    String[] parts = lines.get(i).split(",");
                    if (parts.length >= 2) {
                        try {
                            double elapsed = Double.parseDouble(parts[1]);
                            responseTimes.add(elapsed);
                            avgResponseTime += elapsed;
                            minResponseTime = Math.min(minResponseTime, elapsed);
                            maxResponseTime = Math.max(maxResponseTime, elapsed);
                        } catch (NumberFormatException ignored) {}
                    }
                }
                if (!responseTimes.isEmpty()) {
                    avgResponseTime /= responseTimes.size();
                    responseTimes.sort(Double::compare);
                }
            } catch (IOException e) {
                log.warn("Failed to parse JTL file: {}", e.getMessage());
            }
        }

        if (minResponseTime == Double.MAX_VALUE) minResponseTime = 0;

        return LoadTestResult.LoadTestMetrics.builder()
                .totalRequests(totalRequests)
                .successfulRequests(totalRequests - failedRequests)
                .failedRequests(failedRequests)
                .avgResponseTime(avgResponseTime)
                .minResponseTime(minResponseTime)
                .maxResponseTime(maxResponseTime)
                .p90ResponseTime(getPercentile(responseTimes, 90))
                .p95ResponseTime(getPercentile(responseTimes, 95))
                .p99ResponseTime(getPercentile(responseTimes, 99))
                .errorRate(totalRequests > 0 ? (failedRequests * 100.0 / totalRequests) : 0)
                .throughput(throughput)
                .build();
    }

    private double getPercentile(List<Double> sortedValues, int percentile) {
        if (sortedValues.isEmpty()) return 0;
        int index = (int) Math.ceil((percentile / 100.0) * sortedValues.size()) - 1;
        return sortedValues.get(Math.max(0, Math.min(index, sortedValues.size() - 1)));
    }

    private boolean evaluateCriteria(LoadTestResult.LoadTestMetrics metrics, LoadTestConfig config) {
        boolean passed = true;

        if (config.getMaxResponseTime() != null && metrics.getAvgResponseTime() > config.getMaxResponseTime()) {
            passed = false;
        }

        if (config.getMaxErrorRate() != null && metrics.getErrorRate() > config.getMaxErrorRate()) {
            passed = false;
        }

        if (config.getMinThroughput() != null && metrics.getThroughput() < config.getMinThroughput()) {
            passed = false;
        }

        return passed;
    }
}
