package com.dashboard.command.cliworkflow.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArtifactResult {
    private String path;
    private String varName;       // Variable name if artifact captures a variable
    private String resolvedPath;  // Full resolved path for variable capture
    private boolean exists;
    private boolean passed;
    private String error;
}
