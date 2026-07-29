package com.compledger.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Allows the Vite frontend (running on a different port) to call this API
 * without the browser blocking the request due to the same-origin policy.
 *
 * In production you would restrict allowedOriginPatterns to the actual
 * frontend domain instead of "*".
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    /**
     * Applies permissive CORS headers to every endpoint ("/**").
     * Allows any origin, HTTP method, and request header.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")  // allow any origin (e.g. localhost:3000)
                .allowedMethods("*")          // GET, POST, PUT, DELETE, OPTIONS, …
                .allowedHeaders("*");         // Content-Type, Authorization, …
    }
}
