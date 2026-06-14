package com.dashboard.command.synthetic.dto.inbound;

import com.dashboard.command.synthetic.domain.DynamicField;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

import java.util.List;
import java.util.Map;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProbeRequestDto {
    private String url;
    @Builder.Default
    private String method = "GET";
    private String body;
    private Map<String, String> headers;
    private List<DynamicField> dynamicFields;
}
