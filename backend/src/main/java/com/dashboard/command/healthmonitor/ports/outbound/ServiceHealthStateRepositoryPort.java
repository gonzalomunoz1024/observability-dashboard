package com.dashboard.command.healthmonitor.ports.outbound;

import com.dashboard.command.healthmonitor.domain.ServiceHealthState;
import reactor.core.publisher.Mono;

public interface ServiceHealthStateRepositoryPort {

    Mono<ServiceHealthState> findByServiceId(Long serviceId);

    Mono<ServiceHealthState> save(ServiceHealthState state);

    Mono<Void> deleteByServiceId(Long serviceId);
}
