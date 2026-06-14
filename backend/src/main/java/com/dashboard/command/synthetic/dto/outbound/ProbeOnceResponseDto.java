package com.dashboard.command.synthetic.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProbeOnceResponseDto {
    private ProbeResponseDto start;
    private String extractedId;
    private String resolvedProbeUrl;
    private ProbeResponseDto probe;
    /** Populated when the chain fails before the probe call. */
    private String error;
}
