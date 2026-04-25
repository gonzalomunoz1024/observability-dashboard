package com.dashboard.command.synthetic.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class TraceRequestDto {
    private String correlationId;
    private String expectedFlow;
    private String index;
    @Builder.Default
    private long timeout = 30000;
}
