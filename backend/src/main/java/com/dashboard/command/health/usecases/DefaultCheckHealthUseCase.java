package com.dashboard.command.health.usecases;

import com.dashboard.command.health.domain.command.CheckHealthCommand;
import com.dashboard.command.health.domain.HealthStatus;
import com.dashboard.command.health.ports.outbound.HttpClientPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class DefaultCheckHealthUseCase implements CheckHealthUseCase {

    private final HttpClientPort httpClientPort;

    @Override
    public Mono<HealthStatus> execute(CheckHealthCommand command) {
        return httpClientPort.checkEndpoint(
                command.getUrl(),
                command.getMethod(),
                command.getTimeout(),
                command.getExpectedStatus()
        );
    }
}
