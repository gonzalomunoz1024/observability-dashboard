package com.dashboard.command.synthetic.ports.outbound;

import com.dashboard.command.synthetic.domain.HttpProbeResponse;
import reactor.core.publisher.Mono;

import java.util.Map;

public interface HttpProbePort {
    Mono<HttpProbeResponse> execute(String url, String method, String body, Map<String, String> headers);
}
