package com.dashboard.command.synthetic.dto.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class TraceResponseDto {
    private String correlationId;
    private List<String> expectedFlow;
    private List<Map<String, Object>> foundEvents;
    private List<String> completedSteps;
    private List<String> missingSteps;
    private String status;
    private long elapsedTime;
}
