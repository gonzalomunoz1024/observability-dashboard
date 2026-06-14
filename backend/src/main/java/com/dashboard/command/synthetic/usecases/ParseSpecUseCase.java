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
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParseSpecUseCase {

    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    // Common spec locations Springdoc / Springfox / FastAPI / etc. expose. Tried
    // in order when the URL the user pasted returns an HTML Swagger UI page and
    // we can't extract the underlying spec link.
    private static final List<String> COMMON_SPEC_PATHS = List.of(
            "/v3/api-docs", "/v3/api-docs.yaml",
            "/v2/api-docs", "/v2/api-docs.yaml",
            "/openapi.json", "/openapi.yaml", "/openapi",
            "/api-docs", "/api-docs.json", "/api-docs.yaml",
            "/swagger.json", "/swagger.yaml"
    );

    private static final Pattern SWAGGER_BUNDLE_URL =
            Pattern.compile("SwaggerUIBundle\\s*\\(\\s*\\{[^}]*?url\\s*:\\s*['\"]([^'\"]+)['\"]", Pattern.DOTALL);
    private static final Pattern DATA_URL =
            Pattern.compile("data-url\\s*=\\s*['\"]([^'\"]+)['\"]");
    private static final Pattern SPEC_URL_ATTR =
            Pattern.compile("spec-url\\s*=\\s*['\"]([^'\"]+)['\"]");
    private static final Pattern SCRIPT_API_DOCS =
            Pattern.compile("src\\s*=\\s*['\"]([^'\"]*(?:api-docs|openapi)[^'\"]*)['\"]", Pattern.CASE_INSENSITIVE);

    public Mono<ParsedSpecDto> parse(String source, String value) {
        if (value == null || value.isBlank()) {
            return Mono.error(new IllegalArgumentException("Spec source is required"));
        }
        boolean fromUrl = "url".equalsIgnoreCase(source);
        String specUrl = fromUrl ? value.trim() : null;
        Mono<String> content = fromUrl ? resolveSpecFromUrl(specUrl) : Mono.just(value);

        return content.map(body -> parseString(body, specUrl));
    }

    /**
     * Fetches the URL. If the response is HTML (Swagger UI / Redoc / etc.),
     * tries to discover the actual spec URL — first by scraping the HTML for
     * an embedded `url:` reference, then by probing common spec paths like
     * `/v3/api-docs`. Returns the spec body when found, an explanatory error
     * otherwise.
     */
    private Mono<String> resolveSpecFromUrl(String url) {
        return fetchRaw(url).flatMap(body -> {
            if (!looksLikeHtml(body)) return Mono.just(body);

            String embedded = extractSpecUrl(body);
            if (embedded != null) {
                String resolved = resolveUrl(url, embedded);
                return fetchRaw(resolved).flatMap(specBody ->
                        looksLikeHtml(specBody)
                                ? Mono.error(new IllegalArgumentException(
                                "Spec link in the HTML page also returned HTML: " + resolved))
                                : Mono.just(specBody));
            }
            return probeCommonPaths(url);
        });
    }

    private Mono<String> fetchRaw(String url) {
        return webClientBuilder.build()
                .get()
                .uri(url)
                .retrieve()
                .bodyToMono(String.class)
                .onErrorMap(e -> new IllegalArgumentException("Failed to fetch " + url + ": " + e.getMessage()));
    }

    private boolean looksLikeHtml(String body) {
        if (body == null) return false;
        String trimmed = body.stripLeading();
        if (trimmed.length() < 5) return false;
        String lower = trimmed.substring(0, Math.min(trimmed.length(), 256)).toLowerCase();
        return lower.startsWith("<!doctype html") || lower.startsWith("<html");
    }

    private String extractSpecUrl(String html) {
        for (Pattern p : List.of(SWAGGER_BUNDLE_URL, DATA_URL, SPEC_URL_ATTR, SCRIPT_API_DOCS)) {
            Matcher m = p.matcher(html);
            if (m.find()) {
                String candidate = m.group(1).trim();
                if (!candidate.isEmpty()
                        && !candidate.endsWith(".js")
                        && !candidate.endsWith(".css")
                        && !candidate.contains("swagger-ui-bundle")
                        && !candidate.contains("swagger-ui-standalone")) {
                    return candidate;
                }
            }
        }
        return null;
    }

    /**
     * Resolve an OpenAPI `servers.url` against the spec source URL the user
     * loaded. Many specs ship `servers: [{url: "/"}]` or omit it entirely;
     * without resolution, a WebClient call ends up on loopback.
     */
    private String resolveServerUrl(String serverUrl, String specSourceUrl) {
        if (serverUrl == null) serverUrl = "";
        String trimmed = serverUrl.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
        if (specSourceUrl == null) return trimmed;
        String origin = originOf(specSourceUrl);
        if (origin == null) return trimmed;
        if (trimmed.isEmpty() || trimmed.equals("/")) return origin;
        if (trimmed.startsWith("/")) return origin + trimmed;
        return origin + "/" + trimmed;
    }

    private String originOf(String url) {
        try {
            URI uri = URI.create(url);
            if (uri.getScheme() == null || uri.getAuthority() == null) return null;
            return uri.getScheme() + "://" + uri.getAuthority();
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveUrl(String baseUrl, String target) {
        try {
            URI base = URI.create(baseUrl);
            URI resolved = base.resolve(target);
            return resolved.toString();
        } catch (Exception e) {
            return target;
        }
    }

    private Mono<String> probeCommonPaths(String pageUrl) {
        URI base;
        try {
            URI parsed = URI.create(pageUrl);
            base = new URI(parsed.getScheme(), parsed.getAuthority(), null, null, null);
        } catch (Exception e) {
            return Mono.error(new IllegalArgumentException(
                    "URL returned HTML and the spec path could not be guessed. " +
                            "Use the underlying spec URL (e.g., /v3/api-docs)."));
        }

        List<String> candidates = new ArrayList<>();
        URI pageBase = URI.create(pageUrl);
        // First try paths relative to the page URL's directory (useful when the
        // API is mounted under a subpath like /api/swagger).
        String pagePath = pageBase.getPath() == null ? "/" : pageBase.getPath();
        int lastSlash = pagePath.lastIndexOf('/');
        String prefix = lastSlash >= 0 ? pagePath.substring(0, lastSlash) : "";
        for (String suffix : COMMON_SPEC_PATHS) {
            candidates.add(base + prefix + suffix);
        }
        // Then absolute paths at the host root.
        for (String suffix : COMMON_SPEC_PATHS) {
            candidates.add(base + suffix);
        }

        return Flux.fromIterable(candidates.stream().distinct().collect(Collectors.toList()))
                .concatMap(candidate -> fetchRaw(candidate)
                        .filter(body -> !looksLikeHtml(body))
                        .onErrorResume(e -> Mono.empty()))
                .next()
                .switchIfEmpty(Mono.error(new IllegalArgumentException(
                        "URL returned an HTML page (looks like Swagger UI / Redoc) and the underlying " +
                                "spec couldn't be auto-discovered. Try pasting the spec URL directly " +
                                "(e.g., " + base + Arrays.asList("/v3/api-docs", "/openapi.json").get(0) + ").")));
    }

    private ParsedSpecDto parseString(String spec, String specSourceUrl) {
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
                ? api.getServers().stream()
                        .map(s -> resolveServerUrl(s.getUrl(), specSourceUrl))
                        .filter(s -> s != null && !s.isBlank())
                        .collect(Collectors.toList())
                : new ArrayList<>();
        // No usable servers in the spec? Fall back to the origin we fetched the spec from
        // so the start/probe URLs come out absolute, not loopback.
        if (servers.isEmpty() && specSourceUrl != null) {
            String origin = originOf(specSourceUrl);
            if (origin != null) servers = List.of(origin);
        }

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
        // Empty string is a better placeholder than the literal word "string"
        // — users can tell at a glance that a value still needs filling.
        return objectMapper.valueToTree("");
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
