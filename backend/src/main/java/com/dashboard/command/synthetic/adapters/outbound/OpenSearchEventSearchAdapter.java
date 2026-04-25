package com.dashboard.command.synthetic.adapters.outbound;

import com.dashboard.command.synthetic.domain.SyntheticEvent;
import com.dashboard.command.synthetic.ports.outbound.EventSearchPort;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.opensearch.action.search.SearchRequest;
import org.opensearch.action.search.SearchResponse;
import org.opensearch.client.RequestOptions;
import org.opensearch.client.RestHighLevelClient;
import org.opensearch.index.query.QueryBuilders;
import org.opensearch.search.SearchHit;
import org.opensearch.search.builder.SearchSourceBuilder;
import org.opensearch.search.sort.SortOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
public class OpenSearchEventSearchAdapter implements EventSearchPort {

    private final RestHighLevelClient client;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    public OpenSearchEventSearchAdapter(RestHighLevelClient client, ObjectMapper objectMapper) {
        this.client = client;
        this.objectMapper = objectMapper;
    }

    public OpenSearchEventSearchAdapter(ObjectMapper objectMapper) {
        this.client = null;
        this.objectMapper = objectMapper;
    }

    @Override
    public Flux<SyntheticEvent> searchByCorrelationId(String correlationId, String index) {
        if (client == null) {
            log.warn("OpenSearch client not configured, returning empty results");
            return Flux.empty();
        }

        return Mono.fromCallable(() -> {
            SearchRequest searchRequest = new SearchRequest(index);
            SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
            sourceBuilder.query(QueryBuilders.termQuery("correlationId.keyword", correlationId));
            sourceBuilder.sort("timestamp", SortOrder.ASC);
            sourceBuilder.size(100);
            searchRequest.source(sourceBuilder);

            return client.search(searchRequest, RequestOptions.DEFAULT);
        })
        .flatMapMany(response -> Flux.fromArray(response.getHits().getHits()))
        .map(this::mapToSyntheticEvent)
        .onErrorResume(e -> {
            log.error("Error searching OpenSearch: {}", e.getMessage());
            return Flux.empty();
        });
    }

    private SyntheticEvent mapToSyntheticEvent(SearchHit hit) {
        Map<String, Object> source = hit.getSourceAsMap();
        return SyntheticEvent.builder()
                .correlationId((String) source.get("correlationId"))
                .eventType((String) source.get("eventType"))
                .timestamp(source.get("timestamp") != null
                        ? Instant.parse((String) source.get("timestamp"))
                        : null)
                .source((String) source.get("source"))
                .payload((Map<String, Object>) source.get("payload"))
                .build();
    }
}
