package com.dashboard.command.healthmonitor.domain.dto.inbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class RegisterServiceRequestDto {

    @NotBlank(message = "Service name is required")
    private String name;

    @NotBlank(message = "URL is required")
    private String url;

    @Builder.Default
    private String method = "GET";

    @Builder.Default
    private int timeout = 5000;

    @Builder.Default
    private int expectedStatus = 200;

    @Builder.Default
    private int checkIntervalSeconds = 60;

    @NotNull(message = "Alert recipients are required")
    private List<String> alertRecipients;
}
