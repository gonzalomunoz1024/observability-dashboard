package com.dashboard.command.synthetic.domain;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HttpProbeResponse {
    private int statusCode;
    private String body;
}
