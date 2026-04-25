package com.dashboard.command.health.adapters.outbound;

import com.dashboard.command.health.domain.HealthStatus;
import com.dashboard.command.health.ports.outbound.HttpClientPort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class WebClientHttpAdapter implements HttpClientPort {

    private final WebClient webClient;

    @Override
    public Mono<HealthStatus> checkEndpoint(String url, String method, int timeout, int expectedStatus) {
        long startTime = System.currentTimeMillis();

        HttpMethod httpMethod = "HEAD".equalsIgnoreCase(method) ? HttpMethod.HEAD : HttpMethod.GET;

        return webClient.method(httpMethod)
                .uri(url)
                .header("User-Agent", "Dashboard-Health-Check/1.0")
                .retrieve()
                .toBodilessEntity()
                .timeout(Duration.ofMillis(timeout))
                .map(response -> {
                    long responseTime = System.currentTimeMillis() - startTime;
                    int statusCode = response.getStatusCode().value();
                    boolean isHealthy = statusCode == expectedStatus;

                    return HealthStatus.builder()
                            .status(isHealthy ? "healthy" : "unhealthy")
                            .statusCode(statusCode)
                            .responseTime(responseTime)
                            .build();
                })
                .onErrorResume(error -> {
                    long responseTime = System.currentTimeMillis() - startTime;
                    return Mono.just(HealthStatus.builder()
                            .status("unhealthy")
                            .responseTime(responseTime)
                            .error(error.getMessage())
                            .build());
                });
    }
}
