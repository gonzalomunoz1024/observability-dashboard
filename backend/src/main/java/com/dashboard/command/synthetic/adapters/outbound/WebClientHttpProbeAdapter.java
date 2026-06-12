package com.dashboard.command.synthetic.adapters.outbound;

import com.dashboard.command.synthetic.domain.HttpProbeResponse;
import com.dashboard.command.synthetic.ports.outbound.HttpProbePort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class WebClientHttpProbeAdapter implements HttpProbePort {

    private static final Set<String> BODY_METHODS = Set.of("POST", "PUT", "PATCH");

    private final WebClient webClient;

    @Override
    public Mono<HttpProbeResponse> execute(String url, String method, String body, Map<String, String> headers) {
        String httpMethod = method != null && !method.isBlank() ? method.toUpperCase() : "POST";

        WebClient.RequestBodySpec requestSpec = webClient
                .method(HttpMethod.valueOf(httpMethod))
                .uri(url);

        if (headers != null) {
            headers.forEach(requestSpec::header);
        }

        if (BODY_METHODS.contains(httpMethod) && body != null && !body.isBlank()) {
            requestSpec.contentType(MediaType.APPLICATION_JSON);
            return requestSpec.bodyValue(body).exchangeToMono(this::toProbeResponse);
        }

        return requestSpec.exchangeToMono(this::toProbeResponse);
    }

    private Mono<HttpProbeResponse> toProbeResponse(org.springframework.web.reactive.function.client.ClientResponse response) {
        return response.bodyToMono(String.class)
                .defaultIfEmpty("")
                .map(body -> HttpProbeResponse.builder()
                        .statusCode(response.statusCode().value())
                        .body(body)
                        .build());
    }
}
