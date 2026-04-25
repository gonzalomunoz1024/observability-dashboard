package com.dashboard.command.synthetic.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class InjectResponseDto {
    private boolean success;
    private String correlationId;
    private Instant timestamp;
    private String topic;
    private String eventType;
}
