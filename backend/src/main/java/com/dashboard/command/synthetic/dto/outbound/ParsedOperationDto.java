package com.dashboard.command.synthetic.dto.outbound;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class ParsedOperationDto {
    private String method;
    private String path;
    private String operationId;
    private String summary;
    private String description;
    private List<String> tags;
    private List<String> pathParams;
    /** Example body derived from the request schema. Null when no body. */
    private JsonNode requestExample;
    /** Flat list of field descriptors: name (dot path), type, format, enum values. */
    private List<FieldDescriptor> requestFields;
    /** Per-status: { example, fields }. Keyed by status code (or "default"). */
    private Map<String, ResponseDescriptor> responses;

    @Data
    @Builder
    public static class FieldDescriptor {
        private String path;
        private String type;
        private String format;
        private List<String> enumValues;
        private Boolean required;
    }

    @Data
    @Builder
    public static class ResponseDescriptor {
        private JsonNode example;
        private List<FieldDescriptor> fields;
    }
}
