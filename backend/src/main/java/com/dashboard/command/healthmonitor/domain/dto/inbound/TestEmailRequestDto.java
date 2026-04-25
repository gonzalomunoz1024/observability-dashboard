package com.dashboard.command.healthmonitor.domain.dto.inbound;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestEmailRequestDto {

    @NotBlank(message = "Service name is required")
    private String serviceName;

    @NotEmpty(message = "At least one recipient is required")
    private List<String> recipients;
}
