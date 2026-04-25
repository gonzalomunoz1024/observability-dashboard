package com.dashboard.command.healthmonitor.domain.command;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class UpdateServiceCommand {
    private Long id;
    private String name;
    private String url;
    private String method;
    private int timeout;
    private int expectedStatus;
    private int checkIntervalSeconds;
    private boolean enabled;
    private List<String> alertRecipients;
}
