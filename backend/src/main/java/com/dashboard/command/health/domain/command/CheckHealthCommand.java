package com.dashboard.command.health.domain.command;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CheckHealthCommand {
    private String url;
    private String method;
    private int timeout;
    private int expectedStatus;
}
