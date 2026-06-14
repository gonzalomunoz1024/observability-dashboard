package com.dashboard.command.synthetic.dto.outbound;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SyntheticTransactionResponseDto {
    private Long id;
    private String name;
    private String mode;
    private JsonNode config;
    private Integer intervalSeconds;
    private boolean enabled;
    private Instant nextRunAt;
    private Instant lastRunAt;
    private String lastStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
