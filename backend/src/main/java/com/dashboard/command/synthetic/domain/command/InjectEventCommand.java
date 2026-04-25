package com.dashboard.command.synthetic.domain.command;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class InjectEventCommand {
    private String topic;
    private String eventType;
    private Map<String, Object> payload;
}
