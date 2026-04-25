package com.dashboard.command.healthmonitor.ports.outbound;

import com.dashboard.command.healthmonitor.domain.MonitoredService;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface MonitoredServiceRepositoryPort {

    Mono<MonitoredService> save(MonitoredService service);

    Mono<MonitoredService> findById(Long id);

    Flux<MonitoredService> findAllEnabled();

    Flux<MonitoredService> findAll();

    Mono<Void> deleteById(Long id);

    Mono<MonitoredService> update(MonitoredService service);
}
