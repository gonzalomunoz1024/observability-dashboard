package com.dashboard.command.health.adapters.inbound;

import com.dashboard.command.health.domain.command.CheckHealthCommand;
import com.dashboard.command.health.dto.inbound.HealthCheckRequestDto;
import com.dashboard.command.health.dto.outbound.HealthCheckResponseDto;
import com.dashboard.command.health.usecases.CheckHealthUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RestControllerHealthInboundAdapter {

    private final CheckHealthUseCase checkHealthUseCase;

    @GetMapping("/")
    public Mono<ResponseEntity<Map<String, String>>> root() {
        return Mono.just(ResponseEntity.ok(Map.of(
                "status", "ok",
                "message", "Dashboard proxy server (Java/Spring Boot)"
        )));
    }

    @PostMapping("/health-check")
    public Mono<ResponseEntity<?>> healthCheck(@RequestBody HealthCheckRequestDto request) {
        if (request.getUrl() == null || request.getUrl().isBlank()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "URL is required")));
        }

        CheckHealthCommand command = CheckHealthCommand.builder()
                .url(request.getUrl())
                .method(request.getMethod() != null ? request.getMethod() : "GET")
                .timeout(request.getTimeout() > 0 ? request.getTimeout() : 5000)
                .expectedStatus(request.getExpectedStatus() > 0 ? request.getExpectedStatus() : 200)
                .build();

        return checkHealthUseCase.execute(command)
                .map(status -> ResponseEntity.ok(HealthCheckResponseDto.builder()
                        .status(status.getStatus())
                        .statusCode(status.getStatusCode())
                        .responseTime(status.getResponseTime())
                        .error(status.getError())
                        .build()));
    }
}
