package com.dashboard.command.synthetic.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ParsedSpecDto {
    private String title;
    private String version;
    private List<String> servers;
    private List<ParsedOperationDto> operations;
}
