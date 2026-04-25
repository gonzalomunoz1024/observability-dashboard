package com.dashboard.core.cron;

import com.dashboard.command.healthmonitor.usecases.ExecuteHealthChecksUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(value = "health-monitor.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class HealthCheckScheduler {

    private final ExecuteHealthChecksUseCase executeHealthChecksUseCase;

    @Scheduled(
            initialDelayString = "${health-monitor.scheduler.initial-delay:30000}",
            fixedRateString = "${health-monitor.scheduler.fixed-rate:60000}"
    )
    public void executeScheduledHealthChecks() {
        log.debug("Starting scheduled health checks");

        executeHealthChecksUseCase.executeAllChecks()
                .doOnSuccess(count -> log.info("Scheduled health checks completed. Services checked: {}", count))
                .doOnError(error -> log.error("Error during scheduled health checks: {}", error.getMessage()))
                .subscribe();
    }
}
