package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.domain.DynamicField;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Applies generator-backed substitutions to a JSON body. Each entry rewrites
 * one field at a dot-separated path with a fresh value on every call —
 * synthetic transactions get truly unique payloads per run.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DynamicFieldsResolver {

    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final ObjectMapper objectMapper;

    public String apply(String bodyJson, List<DynamicField> fields) {
        if (bodyJson == null || bodyJson.isBlank() || fields == null || fields.isEmpty()) {
            return bodyJson;
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(bodyJson);
        } catch (Exception e) {
            log.debug("Cannot apply dynamic fields to invalid JSON body: {}", e.getMessage());
            return bodyJson;
        }
        if (!root.isContainerNode()) return bodyJson;

        for (DynamicField field : fields) {
            if (field.getPath() == null || field.getPath().isBlank()) continue;
            try {
                setAtPath(root, field.getPath(), generate(field));
            } catch (Exception e) {
                log.warn("Dynamic field '{}' could not be applied: {}", field.getPath(), e.getMessage());
            }
        }

        try {
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            log.warn("Failed to serialize dynamic-field body, returning original: {}", e.getMessage());
            return bodyJson;
        }
    }

    private void setAtPath(JsonNode root, String path, JsonNode value) {
        String[] parts = path.split("\\.");
        JsonNode cursor = root;
        for (int i = 0; i < parts.length - 1; i++) {
            String segment = parts[i];
            JsonNode next = navigate(cursor, segment);
            if (next == null || next.isNull() || next.isMissingNode()) {
                if (cursor instanceof ObjectNode obj) {
                    next = obj.objectNode();
                    obj.set(segment, next);
                } else {
                    return; // can't descend into a non-object container
                }
            }
            cursor = next;
        }
        String leaf = parts[parts.length - 1];
        if (cursor instanceof ObjectNode obj) {
            obj.set(leaf, value);
        } else if (cursor instanceof ArrayNode arr) {
            try {
                int idx = Integer.parseInt(leaf);
                while (arr.size() <= idx) arr.add(objectMapper.nullNode());
                arr.set(idx, value);
            } catch (NumberFormatException ignored) {
                // leaf isn't an array index — silently skip
            }
        }
    }

    private JsonNode navigate(JsonNode node, String segment) {
        if (node instanceof ObjectNode) return node.get(segment);
        if (node instanceof ArrayNode arr) {
            try {
                return arr.get(Integer.parseInt(segment));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private JsonNode generate(DynamicField field) {
        String generator = field.getGenerator() == null ? "" : field.getGenerator().toLowerCase();
        List<String> args = field.getArgs() != null ? field.getArgs() : List.of();
        return switch (generator) {
            case "uuid" -> objectMapper.valueToTree(UUID.randomUUID().toString());
            case "timestampiso", "timestamp_iso", "datetime" ->
                    objectMapper.valueToTree(Instant.now().toString());
            case "timestampms", "timestamp_ms", "timestamp" ->
                    objectMapper.valueToTree(System.currentTimeMillis());
            case "email" -> objectMapper.valueToTree(randomString(10) + "@example.com");
            case "randomint", "random_int" -> {
                int min = parseInt(args, 0, 0);
                int max = parseInt(args, 1, 100);
                if (max < min) { int tmp = min; min = max; max = tmp; }
                yield objectMapper.valueToTree(min + RNG.nextInt(max - min + 1));
            }
            case "randomstring", "random_string" -> {
                int len = parseInt(args, 0, 8);
                if (len < 0) len = 0;
                if (len > 4096) len = 4096;
                yield objectMapper.valueToTree(randomString(len));
            }
            case "enum" -> {
                if (args.isEmpty()) yield objectMapper.nullNode();
                yield objectMapper.valueToTree(args.get(RNG.nextInt(args.size())));
            }
            default -> objectMapper.nullNode();
        };
    }

    private int parseInt(List<String> args, int idx, int fallback) {
        if (args.size() <= idx) return fallback;
        try {
            return Integer.parseInt(args.get(idx).trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    private String randomString(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
