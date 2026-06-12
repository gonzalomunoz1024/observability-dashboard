package com.dashboard.command.synthetic.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

import java.util.Map;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class RestInjectAndCheckRequestDto {
    private String startUrl;
    @Builder.Default
    private String method = "POST";
    private String body;
    private Map<String, String> headers;
    private String probeUrl;
    private String idJsonPath;
    private String statusJsonPath;
    private String expectedStatusValue;
    @Builder.Default
    private long timeout = 30000;
    @Builder.Default
    private long pollInterval = 1000;
}
