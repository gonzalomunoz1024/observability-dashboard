package com.dashboard.command.healthmonitor.usecases;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import com.dashboard.command.healthmonitor.domain.command.UpdateServiceCommand;
import com.dashboard.command.healthmonitor.ports.outbound.MonitoredServiceRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultUpdateServiceUseCase implements UpdateServiceUseCase {

    private final MonitoredServiceRepositoryPort serviceRepository;

    @Override
    public Mono<MonitoredService> execute(UpdateServiceCommand command) {
        log.info("Updating monitored service with id: {}", command.getId());

        return serviceRepository.findById(command.getId())
                .flatMap(existing -> {
                    existing.setName(command.getName());
                    existing.setUrl(command.getUrl());
                    existing.setMethod(command.getMethod());
                    existing.setTimeout(command.getTimeout());
                    existing.setExpectedStatus(command.getExpectedStatus());
                    existing.setCheckIntervalSeconds(command.getCheckIntervalSeconds());
                    existing.setEnabled(command.isEnabled());
                    existing.setAlertRecipients(String.join(",", command.getAlertRecipients()));
                    existing.setUpdatedAt(Instant.now());

                    return serviceRepository.update(existing);
                })
                .doOnSuccess(s -> log.info("Successfully updated service: {}", s.getName()));
    }
}
