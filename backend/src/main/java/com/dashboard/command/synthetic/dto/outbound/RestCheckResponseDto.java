package com.dashboard.command.synthetic.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RestCheckResponseDto {
    private String status;
    private String extractedId;
    private int startStatusCode;
    private String startResponseSnippet;
    private int attempts;
    private int lastStatusCode;
    private String lastResponseSnippet;
    private String matchedValue;
    private String error;
    private long elapsedTime;
}
