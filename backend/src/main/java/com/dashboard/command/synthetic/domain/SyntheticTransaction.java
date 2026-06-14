package com.dashboard.command.synthetic.domain;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SyntheticTransaction {
    private Long id;
    private String name;
    private String mode;
    private String config;
    private Integer intervalSeconds;
    private boolean enabled;
    private Instant nextRunAt;
    private Instant lastRunAt;
    private String lastStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
