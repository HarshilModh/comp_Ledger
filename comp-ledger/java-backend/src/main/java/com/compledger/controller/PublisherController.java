package com.compledger.controller;

import com.compledger.model.Publisher;
import com.compledger.service.PublisherService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Tag(name = "Publishers", description = "Publisher account management")
@RestController
@RequestMapping("/api/publishers")
public class PublisherController {

    private final PublisherService publisherService;

    public PublisherController(PublisherService publisherService) {
        this.publisherService = publisherService;
    }

    @Operation(
            summary = "Register a new publisher",
            description = "Creates a new publisher account and returns an API key. " +
                    "The API key must be included as the X-API-Key header in all subsequent requests.")
    @ApiResponse(responseCode = "201", description = "Publisher created",
            content = @Content(mediaType = "application/json",
                    examples = @ExampleObject(value =
                            "{\"id\": \"uuid\", \"name\": \"New York Times\", \"email\": \"dev@nyt.com\", " +
                            "\"api_key\": \"cl_abc123...\", \"created_at\": \"2026-07-29T...\"}")))
    @ApiResponse(responseCode = "400", description = "Validation error or duplicate email")
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String email = body.get("email");

        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "'name' is required"));
        }
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "'email' is required"));
        }

        try {
            Publisher publisher = publisherService.register(name, email);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", publisher.getId());
            response.put("name", publisher.getName());
            response.put("email", publisher.getEmail());
            response.put("api_key", publisher.getApiKey());
            response.put("created_at", publisher.getCreatedAt().toString());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Get current publisher profile",
            description = "Returns the profile of the publisher identified by the X-API-Key header.")
    @ApiResponse(responseCode = "200", description = "Publisher profile")
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(@RequestAttribute("publisherId") String publisherId) {
        return publisherService.getById(publisherId)
                .map(p -> {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("id", p.getId());
                    response.put("name", p.getName());
                    response.put("email", p.getEmail());
                    response.put("created_at", p.getCreatedAt().toString());
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Regenerate API key",
            description = "Invalidates the current API key and returns a new one. " +
                    "The old key stops working immediately.")
    @ApiResponse(responseCode = "200", description = "New API key generated")
    @PostMapping("/regenerate-key")
    public ResponseEntity<Map<String, Object>> regenerateKey(@RequestAttribute("publisherId") String publisherId) {
        String newKey = publisherService.regenerateApiKey(publisherId);
        return ResponseEntity.ok(Map.of("api_key", newKey));
    }
}
