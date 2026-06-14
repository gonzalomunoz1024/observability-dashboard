package com.dashboard.command.synthetic.dto.outbound;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SyntheticRunResponseDto {
    private Long id;
    private Long transactionId;
    private String transactionName;
    private String mode;
    private String status;
    private String triggerType;
    private Instant startedAt;
    private Instant finishedAt;
    private Long elapsedMs;
    private JsonNode result;
    private String error;
}
