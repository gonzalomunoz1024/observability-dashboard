package com.dashboard.command.synthetic.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class ParseSpecRequestDto {
    /** "url" or "json". When "url", value is the spec URL; when "json", value is the raw spec body. */
    private String source;
    private String value;
}
