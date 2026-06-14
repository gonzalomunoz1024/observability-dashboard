package com.dashboard.command.synthetic.domain;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SyntheticRun {
    private Long id;
    private Long transactionId;
    private String status;
    private String triggerType;
    private Instant startedAt;
    private Instant finishedAt;
    private Long elapsedMs;
    private String result;
    private String error;
}
