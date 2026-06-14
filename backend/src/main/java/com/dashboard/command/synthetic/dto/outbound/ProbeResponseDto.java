package com.dashboard.command.synthetic.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProbeResponseDto {
    private int statusCode;
    private String body;
    private String error;
    private long elapsedTime;
}
