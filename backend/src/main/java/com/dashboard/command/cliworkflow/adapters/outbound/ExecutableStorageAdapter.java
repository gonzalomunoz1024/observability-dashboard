package com.dashboard.command.cliworkflow.adapters.outbound;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class ExecutableStorageAdapter {

    private static final String STORAGE_DIR = System.getProperty("java.io.tmpdir") + "/dashboard-executables";
    private final Map<String, ExecutableInfo> executables = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() throws IOException {
        Path storagePath = Paths.get(STORAGE_DIR);
        if (!Files.exists(storagePath)) {
            Files.createDirectories(storagePath);
            log.info("Created executable storage directory: {}", STORAGE_DIR);
        }
    }

    public Mono<ExecutableInfo> store(FilePart filePart) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        String originalName = filePart.filename();
        Path targetPath = Paths.get(STORAGE_DIR, id + "-" + originalName);

        return DataBufferUtils.join(filePart.content())
                .flatMap(dataBuffer -> {
                    try {
                        byte[] bytes = new byte[dataBuffer.readableByteCount()];
                        dataBuffer.read(bytes);
                        DataBufferUtils.release(dataBuffer);

                        Files.write(targetPath, bytes);
                        makeExecutable(targetPath);

                        ExecutableInfo info = new ExecutableInfo(id, originalName, targetPath.toString());
                        executables.put(id, info);

                        log.info("Stored executable: {} -> {}", originalName, targetPath);
                        return Mono.just(info);
                    } catch (IOException e) {
                        log.error("Failed to store executable: {}", originalName, e);
                        return Mono.error(e);
                    }
                });
    }

    public String getPath(String id) {
        ExecutableInfo info = executables.get(id);
        if (info != null) {
            return info.path();
        }
        // If not found in memory, check if file exists (for restarts)
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(Paths.get(STORAGE_DIR), id + "-*")) {
            for (Path path : stream) {
                return path.toString();
            }
        } catch (IOException e) {
            log.warn("Error looking up executable: {}", id);
        }
        return null;
    }

    public ExecutableInfo getInfo(String id) {
        return executables.get(id);
    }

    public boolean delete(String id) {
        ExecutableInfo info = executables.remove(id);
        if (info != null) {
            try {
                Files.deleteIfExists(Paths.get(info.path()));
                log.info("Deleted executable: {}", info.path());
                return true;
            } catch (IOException e) {
                log.warn("Failed to delete executable: {}", info.path(), e);
            }
        }
        return false;
    }

    public Map<String, ExecutableInfo> listAll() {
        return Map.copyOf(executables);
    }

    private void makeExecutable(Path path) throws IOException {
        try {
            Set<PosixFilePermission> perms = Files.getPosixFilePermissions(path);
            perms.add(PosixFilePermission.OWNER_EXECUTE);
            perms.add(PosixFilePermission.GROUP_EXECUTE);
            Files.setPosixFilePermissions(path, perms);
        } catch (UnsupportedOperationException e) {
            // Windows doesn't support POSIX permissions
            log.debug("POSIX permissions not supported, skipping chmod");
        }
    }

    public record ExecutableInfo(String id, String originalName, String path) {}
}
