package com.dashboard.command.cliworkflow.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArtifactCheck {
    private String path;
    @Builder.Default
    private boolean exists = true;
    private List<String> contains;
    private boolean yamlValid;
    private boolean jsonValid;
}
