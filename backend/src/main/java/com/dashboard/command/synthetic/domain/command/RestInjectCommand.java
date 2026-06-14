package com.dashboard.command.synthetic.domain.command;

import com.dashboard.command.synthetic.domain.DynamicField;
import com.dashboard.command.synthetic.domain.RestCheckResult;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Data
@Builder
public class RestInjectCommand {
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
    private List<DynamicField> dynamicFields;
    /**
     * Optional callback invoked at major stages — once after the start
     * request returns and once after each probe attempt. Lets a caller
     * persist partial results so the UI can show progress mid-flight
     * instead of staring at a spinner.
     */
    private Consumer<RestCheckResult> onProgress;
}
