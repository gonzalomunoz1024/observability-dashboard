package com.dashboard.command.cli.adapters.outbound;

import com.dashboard.command.cli.domain.CommandResult;
import com.dashboard.command.cli.ports.outbound.ProcessExecutorPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class JavaProcessExecutorAdapter implements ProcessExecutorPort {

    @Override
    public Mono<CommandResult> execute(String executable, List<String> args, int timeout, String cwd, Map<String, String> env) {
        return execute(executable, args, timeout, cwd, env, null, 100);
    }

    @Override
    public Mono<CommandResult> execute(String executable, List<String> args, int timeout, String cwd, Map<String, String> env,
                                        List<String> stdinInputs, int stdinDelay) {
        return Mono.fromCallable(() -> executeBlocking(executable, args, timeout, cwd, env, stdinInputs, stdinDelay))
                .subscribeOn(Schedulers.boundedElastic());
    }

    private CommandResult executeBlocking(String executable, List<String> args, int timeout, String cwd, Map<String, String> env,
                                          List<String> stdinInputs, int stdinDelay) {
        long startTime = System.currentTimeMillis();

        try {
            List<String> command = new ArrayList<>();
            command.add(executable);
            if (args != null) {
                command.addAll(args);
            }

            ProcessBuilder processBuilder = new ProcessBuilder(command);

            if (cwd != null && !cwd.isBlank()) {
                processBuilder.directory(new File(cwd));
            }

            if (env != null && !env.isEmpty()) {
                processBuilder.environment().putAll(env);
            }

            Process process = processBuilder.start();

            // Shared output buffers - declared before threads so stdin can monitor them
            StringBuilder stdout = new StringBuilder();
            StringBuilder stderr = new StringBuilder();

            // Start stdout/stderr readers first
            Thread stdoutThread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    int ch;
                    while ((ch = reader.read()) != -1) {
                        synchronized (stdout) {
                            stdout.append((char) ch);
                        }
                    }
                } catch (Exception e) {
                    log.error("Error reading stdout", e);
                }
            });

            Thread stderrThread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                    int ch;
                    while ((ch = reader.read()) != -1) {
                        synchronized (stderr) {
                            stderr.append((char) ch);
                        }
                    }
                } catch (Exception e) {
                    log.error("Error reading stderr", e);
                }
            });

            stdoutThread.start();
            stderrThread.start();

            // Write stdin inputs if provided (for interactive CLIs)
            // Strategy: Wait for output to "settle" (no new output for N ms) before sending each input
            // This indicates the CLI has finished rendering a prompt and is waiting for input
            if (stdinInputs != null && !stdinInputs.isEmpty()) {
                Thread stdinThread = new Thread(() -> {
                    try {
                        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));
                        int settleTimeMs = Math.max(stdinDelay, 300); // Time to wait with no output

                        for (int i = 0; i < stdinInputs.size(); i++) {
                            String input = stdinInputs.get(i);

                            // Wait for output to settle (no new output for settleTimeMs)
                            boolean settled = waitForOutputSettle(stdout, process, settleTimeMs, 15000);
                            if (!settled && !process.isAlive()) {
                                log.debug("Process ended before sending input {}", i + 1);
                                break;
                            }

                            if (!process.isAlive()) {
                                break;
                            }

                            // Record current output length before sending input
                            int lengthBeforeInput;
                            synchronized (stdout) {
                                lengthBeforeInput = stdout.length();
                            }

                            // Write the input and newline
                            writer.write(input);
                            writer.newLine();
                            writer.flush();
                            log.info("Sent stdin input {}/{}: '{}'", i + 1, stdinInputs.size(), input);

                            // If not the last input, wait for NEW output (response to our input)
                            if (i < stdinInputs.size() - 1) {
                                waitForNewOutput(stdout, lengthBeforeInput, process, 5000);
                            }
                        }

                        writer.close();
                    } catch (Exception e) {
                        log.error("Error writing stdin: {}", e.getMessage());
                    }
                });
                stdinThread.start();
            }

            boolean completed = process.waitFor(timeout, TimeUnit.MILLISECONDS);
            long duration = System.currentTimeMillis() - startTime;

            if (!completed) {
                process.destroyForcibly();
                stdoutThread.interrupt();
                stderrThread.interrupt();

                return CommandResult.builder()
                        .exitCode(-1)
                        .stdout(cleanInteractiveOutput(stripAnsiCodes(stdout.toString().trim())))
                        .stderr(stripAnsiCodes(stderr.toString().trim()))
                        .duration(duration)
                        .timedOut(true)
                        .build();
            }

            stdoutThread.join(1000);
            stderrThread.join(1000);

            return CommandResult.builder()
                    .exitCode(process.exitValue())
                    .stdout(cleanInteractiveOutput(stripAnsiCodes(stdout.toString().trim())))
                    .stderr(stripAnsiCodes(stderr.toString().trim()))
                    .duration(duration)
                    .timedOut(false)
                    .build();

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Error executing command: {}", e.getMessage());

            return CommandResult.builder()
                    .exitCode(-1)
                    .stdout("")
                    .stderr("")
                    .duration(duration)
                    .timedOut(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    /**
     * Wait for output to "settle" - no new output for settleTimeMs milliseconds.
     * This indicates the CLI has finished rendering and is waiting for input.
     */
    private boolean waitForOutputSettle(StringBuilder stdout, Process process, int settleTimeMs, int timeoutMs) {
        long startTime = System.currentTimeMillis();
        long lastChangeTime = startTime;
        int lastLength = 0;

        synchronized (stdout) {
            lastLength = stdout.length();
        }

        while (System.currentTimeMillis() - startTime < timeoutMs && process.isAlive()) {
            try {
                Thread.sleep(50);

                int currentLength;
                synchronized (stdout) {
                    currentLength = stdout.length();
                }

                if (currentLength != lastLength) {
                    // Output changed, reset settle timer
                    lastLength = currentLength;
                    lastChangeTime = System.currentTimeMillis();
                } else {
                    // No change, check if we've settled
                    if (System.currentTimeMillis() - lastChangeTime >= settleTimeMs) {
                        log.debug("Output settled after {}ms of no change", settleTimeMs);
                        return true;
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }

        return false;
    }

    /**
     * Wait for new output to appear after a certain point.
     * Used to detect when the CLI has processed input and produced new output.
     */
    private boolean waitForNewOutput(StringBuilder stdout, int previousLength, Process process, int timeoutMs) {
        long startTime = System.currentTimeMillis();

        while (System.currentTimeMillis() - startTime < timeoutMs && process.isAlive()) {
            try {
                Thread.sleep(50);

                int currentLength;
                synchronized (stdout) {
                    currentLength = stdout.length();
                }

                if (currentLength > previousLength) {
                    log.debug("New output detected ({} -> {} chars)", previousLength, currentLength);
                    return true;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }

        return false;
    }

    /**
     * Strip ANSI escape codes from output.
     * These are terminal formatting codes (colors, cursor movement) that don't display well in web UIs.
     */
    private String stripAnsiCodes(String input) {
        if (input == null) {
            return null;
        }
        // ANSI escape codes pattern: ESC[ followed by parameters and a letter
        // Also handles other escape sequences like ESC]
        return input.replaceAll("\u001B\\[[;\\d]*[A-Za-z]", "")
                    .replaceAll("\u001B\\][^\\u0007]*\u0007", "") // OSC sequences
                    .replaceAll("\u001B[()][AB012]", "") // Character set selection
                    .replaceAll("[\u0000-\u0008\u000B\u000C\u000E-\u001F]", ""); // Other control chars
    }

    /**
     * Clean up interactive CLI output by collapsing repeated prompt re-renders.
     * Inquirer re-renders the prompt after each keystroke, so we see:
     *   ? Enter App ID: c
     *   ? Enter App ID: cl
     *   ? Enter App ID: cla
     * This collapses them to just show the final state:
     *   ? Enter App ID: claut
     */
    private String cleanInteractiveOutput(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }

        String[] lines = input.split("\n");
        StringBuilder result = new StringBuilder();
        String lastPromptPrefix = null;
        String lastPromptLine = null;

        for (String line : lines) {
            // Check if this is an inquirer prompt line (starts with "? ")
            if (line.startsWith("? ")) {
                // Extract the prompt prefix (e.g., "? Enter App ID: ")
                int colonIndex = line.indexOf(": ");
                if (colonIndex > 0) {
                    String prefix = line.substring(0, colonIndex + 2);

                    if (prefix.equals(lastPromptPrefix)) {
                        // Same prompt, update to latest (longer) version
                        lastPromptLine = line;
                    } else {
                        // New prompt - output the previous one if exists
                        if (lastPromptLine != null) {
                            result.append(lastPromptLine).append("\n");
                        }
                        lastPromptPrefix = prefix;
                        lastPromptLine = line;
                    }
                } else {
                    // Prompt without colon (like selection prompts)
                    if (lastPromptLine != null) {
                        result.append(lastPromptLine).append("\n");
                        lastPromptLine = null;
                        lastPromptPrefix = null;
                    }
                    result.append(line).append("\n");
                }
            } else {
                // Not a prompt line - output any pending prompt and this line
                if (lastPromptLine != null) {
                    result.append(lastPromptLine).append("\n");
                    lastPromptLine = null;
                    lastPromptPrefix = null;
                }
                result.append(line).append("\n");
            }
        }

        // Don't forget the last prompt if exists
        if (lastPromptLine != null) {
            result.append(lastPromptLine).append("\n");
        }

        return result.toString().trim();
    }
}
