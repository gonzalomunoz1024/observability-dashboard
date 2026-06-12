package com.dashboard.command.synthetic.adapters.inbound;

import com.dashboard.command.synthetic.domain.RestCheckResult;
import com.dashboard.command.synthetic.dto.inbound.RestInjectAndCheckRequestDto;
import com.dashboard.command.synthetic.usecases.RestInjectAndProbeUseCase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.assertj.core.api.Assertions.assertThat;

class RestControllerSyntheticInboundAdapterTest {

    private RestControllerSyntheticInboundAdapter adapter;

    @BeforeEach
    void setUp() {
        RestInjectAndProbeUseCase useCase = command -> Mono.just(RestCheckResult.builder()
                .status("complete")
                .attempts(1)
                .build());
        adapter = new RestControllerSyntheticInboundAdapter(null, null, useCase);
    }

    private static RestInjectAndCheckRequestDto.RestInjectAndCheckRequestDtoBuilder validRequest() {
        return RestInjectAndCheckRequestDto.builder()
                .startUrl("http://example.test/start")
                .probeUrl("http://example.test/status/{{id}}")
                .idJsonPath("$.id")
                .statusJsonPath("$.status")
                .expectedStatusValue("COMPLETED");
    }

    @Test
    void returns400WhenStartUrlMissing() {
        StepVerifier.create(adapter.restInjectAndCheck(validRequest().startUrl(null).build()))
                .assertNext(response -> assertThat(response.getStatusCode().value()).isEqualTo(400))
                .verifyComplete();
    }

    @Test
    void returns400WhenProbeUrlMissing() {
        StepVerifier.create(adapter.restInjectAndCheck(validRequest().probeUrl(" ").build()))
                .assertNext(response -> assertThat(response.getStatusCode().value()).isEqualTo(400))
                .verifyComplete();
    }

    @Test
    void returns400WhenStatusJsonPathMissing() {
        StepVerifier.create(adapter.restInjectAndCheck(validRequest().statusJsonPath(null).build()))
                .assertNext(response -> assertThat(response.getStatusCode().value()).isEqualTo(400))
                .verifyComplete();
    }

    @Test
    void returns400WhenExpectedValueMissing() {
        StepVerifier.create(adapter.restInjectAndCheck(validRequest().expectedStatusValue("").build()))
                .assertNext(response -> assertThat(response.getStatusCode().value()).isEqualTo(400))
                .verifyComplete();
    }

    @Test
    void returns400WhenIdPathMissingButPlaceholderPresent() {
        StepVerifier.create(adapter.restInjectAndCheck(validRequest().idJsonPath(null).build()))
                .assertNext(response -> assertThat(response.getStatusCode().value()).isEqualTo(400))
                .verifyComplete();
    }

    @Test
    void returns200ForValidRequest() {
        StepVerifier.create(adapter.restInjectAndCheck(validRequest().build()))
                .assertNext(response -> {
                    assertThat(response.getStatusCode().value()).isEqualTo(200);
                    assertThat(((ResponseEntity<?>) response).getBody()).isNotNull();
                })
                .verifyComplete();
    }

    @Test
    void allowsStaticProbeUrlWithoutIdPath() {
        StepVerifier.create(adapter.restInjectAndCheck(validRequest()
                        .probeUrl("http://example.test/status/static")
                        .idJsonPath(null)
                        .build()))
                .assertNext(response -> assertThat(response.getStatusCode().value()).isEqualTo(200))
                .verifyComplete();
    }
}
