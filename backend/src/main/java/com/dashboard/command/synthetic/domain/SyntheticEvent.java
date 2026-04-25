package com.dashboard.command.synthetic.domain;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
public class SyntheticEvent {
    private String correlationId;
    private String eventType;
    private Instant timestamp;
    private String source;
    private Map<String, Object> payload;
}
