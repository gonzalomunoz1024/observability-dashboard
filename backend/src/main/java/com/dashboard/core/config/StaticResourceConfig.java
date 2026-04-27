package com.dashboard.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

/**
 * Configuration for serving the bundled React frontend as static resources.
 * This enables running the entire application from a single JAR.
 */
@Configuration
public class StaticResourceConfig {

    @Bean
    public RouterFunction<ServerResponse> staticResourceRouter() {
        return RouterFunctions
                // Serve static files from /static folder in classpath
                .resources("/**", new ClassPathResource("static/"));
    }

    @Bean
    public RouterFunction<ServerResponse> spaRouter() {
        // SPA fallback: serve index.html for non-API routes that don't match static files
        return RouterFunctions.route()
                .GET("/{path:^(?!api|actuator|h2-console).*$}", request -> {
                    String path = request.pathVariable("path");
                    // If it looks like a file with extension, let static handler deal with it
                    if (path.contains(".")) {
                        return ServerResponse.notFound().build();
                    }
                    // Otherwise serve index.html for SPA routing
                    return ServerResponse.ok()
                            .contentType(MediaType.TEXT_HTML)
                            .bodyValue(new ClassPathResource("static/index.html"));
                })
                .GET("/", request -> ServerResponse.ok()
                        .contentType(MediaType.TEXT_HTML)
                        .bodyValue(new ClassPathResource("static/index.html")))
                .build();
    }
}
