package com.dashboard.command.synthetic.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

import java.util.Map;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class InjectAndTraceRequestDto {
    private String topic;
    private String eventType;
    private Map<String, Object> payload;
    private String expectedFlow;
    private String index;
    @Builder.Default
    private long timeout = 30000;
}
