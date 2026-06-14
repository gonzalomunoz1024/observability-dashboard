package com.dashboard.command.synthetic.usecases;

import com.dashboard.command.synthetic.dto.outbound.ParsedOperationDto;
import com.dashboard.command.synthetic.dto.outbound.ParsedSpecDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.ParseOptions;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParseSpecUseCase {

    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    public Mono<ParsedSpecDto> parse(String source, String value) {
        if (value == null || value.isBlank()) {
            return Mono.error(new IllegalArgumentException("Spec source is required"));
        }
        Mono<String> content = "url".equalsIgnoreCase(source)
                ? fetchUrl(value.trim())
                : Mono.just(value);

        return content.map(this::parseString);
    }

    private Mono<String> fetchUrl(String url) {
        return webClientBuilder.build()
                .get()
                .uri(url)
                .retrieve()
                .bodyToMono(String.class)
                .onErrorMap(e -> new IllegalArgumentException("Failed to fetch spec: " + e.getMessage()));
    }

    private ParsedSpecDto parseString(String spec) {
        ParseOptions options = new ParseOptions();
        options.setResolve(true);
        options.setResolveFully(true);
        SwaggerParseResult result = new OpenAPIV3Parser().readContents(spec, null, options);
        OpenAPI api = result.getOpenAPI();
        if (api == null) {
            String msg = result.getMessages() != null && !result.getMessages().isEmpty()
                    ? String.join("; ", result.getMessages())
                    : "Not a valid OpenAPI/Swagger document";
            throw new IllegalArgumentException(msg);
        }

        List<String> servers = api.getServers() != null
                ? api.getServers().stream().map(Server::getUrl).collect(Collectors.toList())
                : List.of();

        List<ParsedOperationDto> ops = new ArrayList<>();
        if (api.getPaths() != null) {
            api.getPaths().forEach((path, item) -> {
                addOperation(ops, "GET", path, item.getGet());
                addOperation(ops, "POST", path, item.getPost());
                addOperation(ops, "PUT", path, item.getPut());
                addOperation(ops, "PATCH", path, item.getPatch());
                addOperation(ops, "DELETE", path, item.getDelete());
                addOperation(ops, "HEAD", path, item.getHead());
                addOperation(ops, "OPTIONS", path, item.getOptions());
            });
        }

        return ParsedSpecDto.builder()
                .title(api.getInfo() != null ? api.getInfo().getTitle() : null)
                .version(api.getInfo() != null ? api.getInfo().getVersion() : null)
                .servers(servers)
                .operations(ops)
                .build();
    }

    private void addOperation(List<ParsedOperationDto> sink, String method, String path, Operation op) {
        if (op == null) return;

        List<String> pathParams = new ArrayList<>();
        if (op.getParameters() != null) {
            for (Parameter p : op.getParameters()) {
                if ("path".equalsIgnoreCase(p.getIn())) {
                    pathParams.add(p.getName());
                }
            }
        }

        JsonNode requestExample = null;
        List<ParsedOperationDto.FieldDescriptor> requestFields = new ArrayList<>();
        RequestBody body = op.getRequestBody();
        if (body != null && body.getContent() != null) {
            Schema<?> schema = pickJsonSchema(body.getContent());
            if (schema != null) {
                requestExample = buildExample(schema, new HashMap<>());
                collectFields("", schema, schema.getRequired(), requestFields, new HashMap<>());
            }
        }

        Map<String, ParsedOperationDto.ResponseDescriptor> responses = new LinkedHashMap<>();
        if (op.getResponses() != null) {
            op.getResponses().forEach((code, resp) -> {
                ParsedOperationDto.ResponseDescriptor descriptor = describeResponse(resp);
                if (descriptor != null) responses.put(code, descriptor);
            });
        }

        sink.add(ParsedOperationDto.builder()
                .method(method)
                .path(path)
                .operationId(op.getOperationId())
                .summary(op.getSummary())
                .description(op.getDescription())
                .tags(op.getTags())
                .pathParams(pathParams)
                .requestExample(requestExample)
                .requestFields(requestFields)
                .responses(responses)
                .build());
    }

    private ParsedOperationDto.ResponseDescriptor describeResponse(ApiResponse resp) {
        if (resp == null || resp.getContent() == null) return null;
        Schema<?> schema = pickJsonSchema(resp.getContent());
        if (schema == null) return null;
        JsonNode example = buildExample(schema, new HashMap<>());
        List<ParsedOperationDto.FieldDescriptor> fields = new ArrayList<>();
        collectFields("", schema, schema.getRequired(), fields, new HashMap<>());
        return ParsedOperationDto.ResponseDescriptor.builder()
                .example(example)
                .fields(fields)
                .build();
    }

    private Schema<?> pickJsonSchema(Map<String, io.swagger.v3.oas.models.media.MediaType> content) {
        if (content == null || content.isEmpty()) return null;
        io.swagger.v3.oas.models.media.MediaType media = content.get("application/json");
        if (media == null) media = content.values().iterator().next();
        return media != null ? media.getSchema() : null;
    }

    /** Build a sample JSON value for a schema. Recursion guard prevents cycles. */
    private JsonNode buildExample(Schema<?> schema, Map<Schema<?>, Integer> seen) {
        if (schema == null) return objectMapper.nullNode();
        if (schema.getExample() != null) {
            try {
                return objectMapper.valueToTree(schema.getExample());
            } catch (Exception ignored) { /* fall through */ }
        }
        if (schema.getDefault() != null) {
            try {
                return objectMapper.valueToTree(schema.getDefault());
            } catch (Exception ignored) { /* fall through */ }
        }
        if (schema.getEnum() != null && !schema.getEnum().isEmpty()) {
            return objectMapper.valueToTree(schema.getEnum().get(0));
        }
        int depth = seen.getOrDefault(schema, 0);
        if (depth > 2) return objectMapper.nullNode();
        seen.put(schema, depth + 1);

        String type = schema.getType();
        if (type == null && schema.getProperties() != null) type = "object";

        if ("object".equals(type) || schema.getProperties() != null) {
            ObjectNode node = objectMapper.createObjectNode();
            if (schema.getProperties() != null) {
                schema.getProperties().forEach((name, propSchema) -> {
                    node.set(name, buildExample(propSchema, seen));
                });
            }
            return node;
        }
        if ("array".equals(type)) {
            ArrayNode node = objectMapper.createArrayNode();
            Schema<?> items = schema.getItems();
            if (items != null) node.add(buildExample(items, seen));
            return node;
        }
        if ("integer".equals(type) || "number".equals(type)) {
            return objectMapper.valueToTree(0);
        }
        if ("boolean".equals(type)) {
            return objectMapper.valueToTree(false);
        }
        // string and unknown
        String format = schema.getFormat();
        if ("date-time".equals(format)) return objectMapper.valueToTree("1970-01-01T00:00:00Z");
        if ("date".equals(format)) return objectMapper.valueToTree("1970-01-01");
        if ("uuid".equals(format)) return objectMapper.valueToTree("00000000-0000-0000-0000-000000000000");
        if ("email".equals(format)) return objectMapper.valueToTree("user@example.com");
        return objectMapper.valueToTree("string");
    }

    /** Walk schema and emit a flat list of leaf-ish fields (objects expanded, arrays not). */
    @SuppressWarnings("unchecked")
    private void collectFields(String prefix, Schema<?> schema, List<String> requiredList,
                                List<ParsedOperationDto.FieldDescriptor> sink,
                                Map<Schema<?>, Integer> seen) {
        if (schema == null) return;
        int depth = seen.getOrDefault(schema, 0);
        if (depth > 2) return;
        seen.put(schema, depth + 1);

        String type = schema.getType();
        if (type == null && schema.getProperties() != null) type = "object";

        if ("object".equals(type) && schema.getProperties() != null) {
            List<String> required = schema.getRequired() != null ? schema.getRequired() : List.of();
            schema.getProperties().forEach((name, propSchema) -> {
                String nextPath = prefix.isEmpty() ? name : prefix + "." + name;
                String childType = propSchema.getType();
                if (childType == null && propSchema.getProperties() != null) childType = "object";

                if ("object".equals(childType) && propSchema.getProperties() != null) {
                    collectFields(nextPath, propSchema, propSchema.getRequired(), sink, seen);
                } else {
                    List<?> rawEnum = propSchema.getEnum();
                    List<String> enumVals = rawEnum != null
                            ? rawEnum.stream().map(String::valueOf).collect(Collectors.toList())
                            : null;
                    sink.add(ParsedOperationDto.FieldDescriptor.builder()
                            .path(nextPath)
                            .type(childType != null ? childType : "string")
                            .format(propSchema.getFormat())
                            .enumValues(enumVals)
                            .required(required.contains(name))
                            .build());
                }
            });
        }
    }
}
