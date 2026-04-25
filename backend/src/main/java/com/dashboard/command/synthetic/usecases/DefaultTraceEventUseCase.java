package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.domain.TraceResult;
import com.dashboard.command.synthetic.domain.command.TraceEventCommand;
import com.dashboard.command.synthetic.ports.outbound.EventSearchPort;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DefaultTraceEventUseCase implements TraceEventUseCase {

    private final EventSearchPort eventSearchPort;

    @Value("${opensearch.index:events}")
    private String defaultIndex;

    @Override
    public Mono<TraceResult> execute(TraceEventCommand command) {
        long startTime = System.currentTimeMillis();
        String index = command.getIndex() != null ? command.getIndex() : defaultIndex;
        List<String> expectedFlow = Arrays.stream(command.getExpectedFlow().split("->"))
                .map(String::trim)
                .collect(Collectors.toList());

        return pollForEvents(command.getCorrelationId(), index, expectedFlow, command.getTimeout(), startTime);
    }

    private Mono<TraceResult> pollForEvents(String correlationId, String index,
                                             List<String> expectedFlow, long timeout, long startTime) {
        return eventSearchPort.searchByCorrelationId(correlationId, index)
                .collectList()
                .flatMap(events -> {
                    long elapsed = System.currentTimeMillis() - startTime;
                    List<String> foundEventTypes = events.stream()
                            .map(SyntheticEvent::getEventType)
                            .collect(Collectors.toList());

                    List<String> completedSteps = expectedFlow.stream()
                            .filter(foundEventTypes::contains)
                            .collect(Collectors.toList());

                    List<String> missingSteps = expectedFlow.stream()
                            .filter(step -> !foundEventTypes.contains(step))
                            .collect(Collectors.toList());

                    if (missingSteps.isEmpty()) {
                        return Mono.just(TraceResult.builder()
                                .correlationId(correlationId)
                                .expectedFlow(expectedFlow)
                                .foundEvents(events)
                                .completedSteps(completedSteps)
                                .missingSteps(missingSteps)
                                .status("complete")
                                .elapsedTime(elapsed)
                                .build());
                    }

                    if (elapsed >= timeout) {
                        String status = completedSteps.isEmpty() ? "timeout" : "partial";
                        return Mono.just(TraceResult.builder()
                                .correlationId(correlationId)
                                .expectedFlow(expectedFlow)
                                .foundEvents(events)
                                .completedSteps(completedSteps)
                                .missingSteps(missingSteps)
                                .status(status)
                                .elapsedTime(elapsed)
                                .build());
                    }

                    return Mono.delay(Duration.ofSeconds(1))
                            .flatMap(tick -> pollForEvents(correlationId, index, expectedFlow, timeout, startTime));
                });
    }
}
