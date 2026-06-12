package com.dashboard.command.synthetic.domain.command;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class RestInjectCommand {
    private String startUrl;
    @Builder.Default
    private String method = "POST";
    private String body;
    private Map<String, String> headers;
    private String checkerUrl;
    private String idJsonPath;
    private String statusJsonPath;
    private String expectedStatusValue;
    @Builder.Default
    private long timeout = 30000;
    @Builder.Default
    private long pollInterval = 1000;
}
