package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.HttpProbeResponse;
import com.dashboard.command.synthetic.domain.RestCheckResult;
import com.dashboard.command.synthetic.domain.command.RestInjectCommand;
import com.dashboard.command.synthetic.ports.outbound.HttpProbePort;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class DefaultRestInjectAndCheckUseCaseTest {

    private static HttpProbeResponse response(int status, String body) {
        return HttpProbeResponse.builder().statusCode(status).body(body).build();
    }

    private static RestInjectCommand.RestInjectCommandBuilder baseCommand() {
        return RestInjectCommand.builder()
                .startUrl("http://example.test/start")
                .method("POST")
                .body("{\"foo\":\"bar\"}")
                .probeUrl("http://example.test/status/{{id}}")
                .idJsonPath("$.transactionId")
                .statusJsonPath("$.status")
                .expectedStatusValue("COMPLETED")
                .timeout(2000)
                .pollInterval(250);
    }

    @Test
    void completesWhenProbeMatchesOnSecondAttempt() {
        AtomicInteger probeCalls = new AtomicInteger();
        HttpProbePort port = (url, method, body, headers) -> {
            if (url.endsWith("/start")) {
                return Mono.just(response(200, "{\"transactionId\":\"tx-123\"}"));
            }
            assertThat(url).isEqualTo("http://example.test/status/tx-123");
            return probeCalls.incrementAndGet() < 2
                    ? Mono.just(response(200, "{\"status\":\"PENDING\"}"))
                    : Mono.just(response(200, "{\"status\":\"COMPLETED\"}"));
        };

        DefaultRestInjectAndCheckUseCase useCase = new DefaultRestInjectAndCheckUseCase(port);

        StepVerifier.create(useCase.execute(baseCommand().build()))
                .assertNext(result -> {
                    assertThat(result.getStatus()).isEqualTo("complete");
                    assertThat(result.getExtractedId()).isEqualTo("tx-123");
                    assertThat(result.getAttempts()).isEqualTo(2);
                    assertThat(result.getMatchedValue()).isEqualTo("COMPLETED");
                    assertThat(result.getStartStatusCode()).isEqualTo(200);
                })
                .verifyComplete();
    }

    @Test
    void timesOutWhenProbeNeverMatches() {
        HttpProbePort port = (url, method, body, headers) ->
                url.endsWith("/start")
                        ? Mono.just(response(200, "{\"transactionId\":\"tx-1\"}"))
                        : Mono.just(response(200, "{\"status\":\"PENDING\"}"));

        DefaultRestInjectAndCheckUseCase useCase = new DefaultRestInjectAndCheckUseCase(port);
        RestInjectCommand command = baseCommand().timeout(600).pollInterval(250).build();

        StepVerifier.create(useCase.execute(command))
                .assertNext(result -> {
                    assertThat(result.getStatus()).isEqualTo("timeout");
                    assertThat(result.getAttempts()).isGreaterThanOrEqualTo(1);
                    assertThat(result.getMatchedValue()).isNull();
                    assertThat(result.getLastResponseSnippet()).contains("PENDING");
                })
                .verifyComplete();
    }

    @Test
    void errorsWhenStartEndpointFails() {
        HttpProbePort port = (url, method, body, headers) ->
                Mono.just(response(500, "{\"message\":\"boom\"}"));

        DefaultRestInjectAndCheckUseCase useCase = new DefaultRestInjectAndCheckUseCase(port);

        StepVerifier.create(useCase.execute(baseCommand().build()))
                .assertNext(result -> {
                    assertThat(result.getStatus()).isEqualTo("error");
                    assertThat(result.getError()).contains("500");
                    assertThat(result.getStartStatusCode()).isEqualTo(500);
                    assertThat(result.getAttempts()).isZero();
                })
                .verifyComplete();
    }

    @Test
    void errorsWhenIdExtractionFails() {
        HttpProbePort port = (url, method, body, headers) ->
                Mono.just(response(200, "{\"somethingElse\":\"x\"}"));

        DefaultRestInjectAndCheckUseCase useCase = new DefaultRestInjectAndCheckUseCase(port);

        StepVerifier.create(useCase.execute(baseCommand().build()))
                .assertNext(result -> {
                    assertThat(result.getStatus()).isEqualTo("error");
                    assertThat(result.getError()).contains("$.transactionId");
                })
                .verifyComplete();
    }

    @Test
    void keepsPollingToTimeoutWhenProbeBodyIsNotJson() {
        HttpProbePort port = (url, method, body, headers) ->
                url.endsWith("/start")
                        ? Mono.just(response(200, "{\"transactionId\":\"tx-1\"}"))
                        : Mono.just(response(200, "<html>not json</html>"));

        DefaultRestInjectAndCheckUseCase useCase = new DefaultRestInjectAndCheckUseCase(port);
        RestInjectCommand command = baseCommand().timeout(600).pollInterval(250).build();

        StepVerifier.create(useCase.execute(command))
                .assertNext(result -> assertThat(result.getStatus()).isEqualTo("timeout"))
                .verifyComplete();
    }

    @Test
    void skipsIdExtractionForStaticProbeUrl() {
        HttpProbePort port = (url, method, body, headers) ->
                url.endsWith("/start")
                        ? Mono.just(response(201, "not even json"))
                        : Mono.just(response(200, "{\"status\":\"COMPLETED\"}"));

        DefaultRestInjectAndCheckUseCase useCase = new DefaultRestInjectAndCheckUseCase(port);
        RestInjectCommand command = baseCommand()
                .probeUrl("http://example.test/status/static")
                .idJsonPath(null)
                .build();

        StepVerifier.create(useCase.execute(command))
                .assertNext(result -> {
                    assertThat(result.getStatus()).isEqualTo("complete");
                    assertThat(result.getExtractedId()).isNull();
                })
                .verifyComplete();
    }

    @Test
    void passesHeadersToBothCalls() {
        Map<String, String> expectedHeaders = Map.of("Authorization", "Bearer token");
        AtomicInteger headerChecks = new AtomicInteger();
        HttpProbePort port = (url, method, body, headers) -> {
            assertThat(headers).isEqualTo(expectedHeaders);
            headerChecks.incrementAndGet();
            return url.endsWith("/start")
                    ? Mono.just(response(200, "{\"transactionId\":\"tx-1\"}"))
                    : Mono.just(response(200, "{\"status\":\"COMPLETED\"}"));
        };

        DefaultRestInjectAndCheckUseCase useCase = new DefaultRestInjectAndCheckUseCase(port);

        StepVerifier.create(useCase.execute(baseCommand().headers(expectedHeaders).build()))
                .assertNext(result -> assertThat(result.getStatus()).isEqualTo("complete"))
                .verifyComplete();
        assertThat(headerChecks.get()).isEqualTo(2);
    }
}
