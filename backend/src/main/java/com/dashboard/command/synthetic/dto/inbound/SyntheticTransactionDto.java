package com.dashboard.command.synthetic.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

@Data
@Builder
@Jacksonized
@JsonIgnoreProperties(ignoreUnknown = true)
public class SyntheticTransactionDto {
    private String name;
    private String mode;
    private JsonNode config;
    private Integer intervalSeconds;
    private Boolean enabled;
}
