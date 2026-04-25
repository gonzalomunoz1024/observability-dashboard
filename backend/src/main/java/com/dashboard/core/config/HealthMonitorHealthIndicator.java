package com.dashboard.core.config;

import com.dashboard.command.healthmonitor.ports.outbound.MonitoredServiceRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.ReactiveHealthIndicator;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class HealthMonitorHealthIndicator implements ReactiveHealthIndicator {

    private final MonitoredServiceRepositoryPort serviceRepository;

    @Override
    public Mono<Health> health() {
        return checkMonitoringSystem()
                .timeout(Duration.ofSeconds(5))
                .onErrorResume(ex -> Mono.just(Health.down()
                        .withDetail("error", ex.getMessage())
                        .build()));
    }

    private Mono<Health> checkMonitoringSystem() {
        return serviceRepository.findAll()
                .count()
                .map(count -> Health.up()
                        .withDetail("monitoredServices", count)
                        .withDetail("status", "Health monitor is operational")
                        .build());
    }
}
