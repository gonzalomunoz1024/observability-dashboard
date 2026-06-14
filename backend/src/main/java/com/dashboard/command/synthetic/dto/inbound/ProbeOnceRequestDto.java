package com.dashboard.command.synthetic.dto.inbound;

import com.dashboard.command.synthetic.domain.DynamicField;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

import java.util.List;
import java.util.Map;

/**
 * Calls the start endpoint, optionally extracts an ID from its response, then
 * calls the probe endpoint ONCE (no polling). Used by the UI's "Pick from
 * response" pickers so users can see what they're targeting before saving.
 */
@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProbeOnceRequestDto {
    private String startUrl;
    @Builder.Default
    private String method = "POST";
    private String body;
    private Map<String, String> headers;
    private String probeUrl;
    private String idJsonPath;
    private List<DynamicField> dynamicFields;
}
