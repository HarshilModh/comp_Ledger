package com.compledger.filter;

import com.compledger.model.Publisher;
import com.compledger.service.PublisherService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Validates the X-API-Key header on protected endpoints.
 * Injects "publisherId" and "publisherName" as request attributes for downstream use.
 *
 * Endpoints that skip authentication:
 *   - /api/health
 *   - /api/publishers/register
 *   - /swagger-ui/**, /api-docs/**
 *
 * To disable auth entirely (e.g., local dev), set auth.enabled=false in application.properties.
 */
@Component
@Order(1)
public class ApiKeyFilter implements Filter {

    private final PublisherService publisherService;
    private final ObjectMapper objectMapper;
    private final boolean authEnabled;

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/health",
            "/api/publishers/register"
    );

    private static final Set<String> PUBLIC_PREFIXES = Set.of(
            "/swagger-ui",
            "/api-docs",
            "/v3/api-docs"
    );

    public ApiKeyFilter(PublisherService publisherService,
                        ObjectMapper objectMapper,
                        @Value("${auth.enabled:true}") boolean authEnabled) {
        this.publisherService = publisherService;
        this.objectMapper = objectMapper;
        this.authEnabled = authEnabled;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        if (!authEnabled) {
            httpRequest.setAttribute("publisherId", "dev-publisher");
            httpRequest.setAttribute("publisherName", "Dev Publisher");
            chain.doFilter(request, response);
            return;
        }

        String path = httpRequest.getRequestURI();

        if (isPublicPath(path)) {
            chain.doFilter(request, response);
            return;
        }

        String apiKey = httpRequest.getHeader("X-API-Key");
        if (apiKey == null || apiKey.isBlank()) {
            sendError(httpResponse, HttpServletResponse.SC_UNAUTHORIZED,
                    "Missing X-API-Key header. Register at POST /api/publishers/register to get one.");
            return;
        }

        Optional<Publisher> publisher = publisherService.authenticate(apiKey);
        if (publisher.isEmpty()) {
            sendError(httpResponse, HttpServletResponse.SC_UNAUTHORIZED, "Invalid API key");
            return;
        }

        httpRequest.setAttribute("publisherId", publisher.get().getId());
        httpRequest.setAttribute("publisherName", publisher.get().getName());
        chain.doFilter(request, response);
    }

    private boolean isPublicPath(String path) {
        if (PUBLIC_PATHS.contains(path)) return true;
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.startsWith(prefix)) return true;
        }
        return false;
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(objectMapper.writeValueAsString(Map.of("error", message)));
    }
}
