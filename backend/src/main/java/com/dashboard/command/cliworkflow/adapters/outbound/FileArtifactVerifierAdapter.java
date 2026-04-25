package com.dashboard.command.cliworkflow.adapters.outbound;

import com.dashboard.command.cliworkflow.domain.ArtifactCheck;
import com.dashboard.command.cliworkflow.domain.ArtifactResult;
import com.dashboard.command.cliworkflow.ports.outbound.ArtifactVerifierPort;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.nio.file.Files;
import java.nio.file.Path;

@Slf4j
@Component
public class FileArtifactVerifierAdapter implements ArtifactVerifierPort {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Yaml yaml = new Yaml();

    @Override
    public Mono<ArtifactResult> verify(ArtifactCheck check, String resolvedPath) {
        return Mono.fromCallable(() -> verifyBlocking(check, resolvedPath))
                .subscribeOn(Schedulers.boundedElastic());
    }

    private ArtifactResult verifyBlocking(ArtifactCheck check, String resolvedPath) {
        Path path = Path.of(resolvedPath);

        // Check existence
        boolean exists = Files.exists(path);
        if (check.isExists() && !exists) {
            return ArtifactResult.builder()
                    .path(resolvedPath)
                    .exists(false)
                    .passed(false)
                    .error("File does not exist")
                    .build();
        }

        if (!check.isExists() && exists) {
            return ArtifactResult.builder()
                    .path(resolvedPath)
                    .exists(true)
                    .passed(false)
                    .error("File exists but should not")
                    .build();
        }

        if (!exists) {
            return ArtifactResult.builder()
                    .path(resolvedPath)
                    .exists(false)
                    .passed(true)
                    .build();
        }

        // File exists, perform additional checks
        try {
            String content = Files.readString(path);

            // Check contains
            if (check.getContains() != null && !check.getContains().isEmpty()) {
                for (String expected : check.getContains()) {
                    if (!content.contains(expected)) {
                        return ArtifactResult.builder()
                                .path(resolvedPath)
                                .exists(true)
                                .passed(false)
                                .error("File does not contain: " + expected)
                                .build();
                    }
                }
            }

            // Validate YAML
            if (check.isYamlValid()) {
                try {
                    yaml.load(content);
                } catch (Exception e) {
                    return ArtifactResult.builder()
                            .path(resolvedPath)
                            .exists(true)
                            .passed(false)
                            .error("Invalid YAML: " + e.getMessage())
                            .build();
                }
            }

            // Validate JSON
            if (check.isJsonValid()) {
                try {
                    objectMapper.readTree(content);
                } catch (Exception e) {
                    return ArtifactResult.builder()
                            .path(resolvedPath)
                            .exists(true)
                            .passed(false)
                            .error("Invalid JSON: " + e.getMessage())
                            .build();
                }
            }

            return ArtifactResult.builder()
                    .path(resolvedPath)
                    .exists(true)
                    .passed(true)
                    .build();

        } catch (Exception e) {
            log.error("Error verifying artifact {}: {}", resolvedPath, e.getMessage());
            return ArtifactResult.builder()
                    .path(resolvedPath)
                    .exists(true)
                    .passed(false)
                    .error("Error reading file: " + e.getMessage())
                    .build();
        }
    }
}
