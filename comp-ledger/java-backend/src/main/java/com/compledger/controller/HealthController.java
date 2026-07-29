package com.compledger.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Tag(name = "Health", description = "Server liveness probe")
@RestController
public class HealthController {

    @Operation(
            summary = "Liveness check",
            description = "Returns `{\"status\": \"ok\"}` when the server is up. " +
                    "Used by load balancers and monitoring tools to verify the service is responsive.")
    @ApiResponse(
            responseCode = "200",
            description = "Server is healthy",
            content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(example = "{\"status\": \"ok\"}"),
                    examples = @ExampleObject(value = "{\"status\": \"ok\"}")))
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
