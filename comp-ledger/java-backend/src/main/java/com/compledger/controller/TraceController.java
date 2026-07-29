package com.compledger.controller;

import com.compledger.model.Claim;
import com.compledger.model.ScoredChunk;
import com.compledger.model.TraceRequest;
import com.compledger.service.DecomposeService;
import com.compledger.service.EmbedService;
import com.compledger.service.RetrieveService;
import com.compledger.service.ScoreService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Trace", description = "Single-model claim tracing via Server-Sent Events")
@RestController
public class TraceController {

    private static final Logger logger = LoggerFactory.getLogger(TraceController.class);

    /** Path to the data directory, used to locate demo-fallback.json */
    @Value("${data.dir}")
    private String dataDir;

    @Autowired private DecomposeService decomposeService;
    @Autowired private EmbedService embedService;
    @Autowired private RetrieveService retrieveService;
    @Autowired private ScoreService scoreService;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TaskExecutor taskExecutor;

    @Operation(
            summary = "Trace an AI answer (SSE)",
            description = """
                    Decomposes the supplied AI-generated answer into atomic factual claims, \
                    then scores each claim against the publisher corpus and reference corpus \
                    using Amazon Bedrock.

                    Results are streamed as **Server-Sent Events** in the order the claims are scored. \
                    The connection stays open until all claims are processed or an error occurs.

                    **SSE event sequence:**
                    | Event | Payload | Description |
                    |---|---|---|
                    | `claims_count` | `{"total": N}` | How many claims were extracted |
                    | `claim_scored` | See schema below | Scored claim (emitted N times) |
                    | `done` | `{}` | All claims processed |
                    | `error` | `{"error": "..."}` | Top-level failure |

                    **`claim_scored` payload fields:**
                    - `claim_id` — sequential integer identifier
                    - `claim_text` — the atomic claim text
                    - `exclusivity_score` — 0.0–1.0; higher = more publisher-exclusive
                    - `match` — `{found, chunk_id, score, text}` — best publisher corpus match
                    - `exclusivity` — `{independent_source_count, reasoning}`
                    - `fingerprint` — `{detected, evidence}` — publisher-specific phrasing detected
                    - `agreement_active` — whether this claim is covered by a licensing agreement
                    - `scoring_failed` — `true` only on per-claim errors

                    **Mock mode:** Add `?mock=true` to replay the last real trace from \
                    `demo-fallback.json` with 600 ms artificial delays — no Bedrock calls are made.
                    """)
    @ApiResponse(
            responseCode = "200",
            description = "SSE stream opened. Events are emitted as claims are scored.",
            content = @Content(
                    mediaType = "text/event-stream",
                    examples = {
                            @ExampleObject(name = "claims_count", value =
                                    "event: claims_count\ndata: {\"total\": 3}\n\n"),
                            @ExampleObject(name = "claim_scored", value =
                                    "event: claim_scored\ndata: {\"claim_id\": 1, \"claim_text\": \"OpenAI was founded in 2015.\", " +
                                    "\"exclusivity_score\": 0.2, \"match\": {\"found\": true, \"score\": 0.91}, " +
                                    "\"fingerprint\": {\"detected\": false}, \"agreement_active\": false}\n\n"),
                            @ExampleObject(name = "done", value =
                                    "event: done\ndata: {}\n\n")
                    }))
    @ApiResponse(responseCode = "500", description = "Server error before the SSE stream could be opened")
    @PostMapping("/api/trace")
    public SseEmitter trace(
            @org.springframework.web.bind.annotation.RequestBody
            @RequestBody(
                    description = "The question and AI-generated answer to trace",
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = TraceRequest.class),
                            examples = @ExampleObject(value =
                                    "{\"question\": \"When was OpenAI founded?\", " +
                                    "\"answer\": \"OpenAI was founded in December 2015 by Sam Altman and others.\", " +
                                    "\"mode\": \"audit\"}")))
            TraceRequest traceRequest,
            @Parameter(description = "Pass `true` to replay `demo-fallback.json` instead of calling Bedrock")
            @RequestParam(required = false) String mock,
            @RequestAttribute(value = "publisherId", required = false) String publisherId) {
        // 300 000ms = 5 minutes — enough headroom for slow multi-claim traces
        SseEmitter emitter = new SseEmitter(300_000L);

        // Run all I/O off the HTTP thread so the thread pool handles concurrency
        taskExecutor.execute(() -> {
            String question = traceRequest.getQuestion();
            String answer = traceRequest.getAnswer();
            String mode = traceRequest.getMode() != null ? traceRequest.getMode() : "audit";

            if (question == null || question.isBlank() || answer == null || answer.isBlank()) {
                try {
                    Map<String, Object> err = new HashMap<>();
                    err.put("error", "Both 'question' and 'answer' fields are required and must not be blank");
                    sendEvent(emitter, "error", objectMapper.writeValueAsString(err));
                    emitter.complete();
                } catch (Exception e) {
                    emitter.completeWithError(e);
                }
                return;
            }

            // --- Mock mode: replay last real trace from disk ---
            if ("true".equals(mock)) {
                File fallbackFile = new File(dataDir, "demo-fallback.json");
                if (fallbackFile.exists()) {
                    try {
                        String content = new String(Files.readAllBytes(fallbackFile.toPath()));
                        Map<?, ?> fallback = objectMapper.readValue(content, Map.class);
                        List<?> events = (List<?>) fallback.get("events");
                        if (events != null) {
                            for (Object eventObj : events) {
                                Map<?, ?> event = (Map<?, ?>) eventObj;
                                String type = (String) event.get("type");
                                Object data = event.get("data");
                                // Serialize the data object back to JSON for the SSE payload
                                String dataJson = objectMapper.writeValueAsString(data);
                                sendEvent(emitter, type, dataJson);
                                Thread.sleep(600); // artificial delay to simulate real-time streaming
                            }
                        }
                        sendEvent(emitter, "done", "{}");
                        emitter.complete();
                        return;
                    } catch (Exception e) {
                        logger.error("Error reading demo-fallback.json: {}", e.getMessage(), e);
                        // Fall through to real mode if the fallback file can't be read
                    }
                }
            }

            // --- Real mode: call Bedrock to decompose and score ---
            try {
                // Step 1: extract atomic claims from the answer
                List<Claim> claims = decomposeService.decompose(question, answer);

                // Notify the frontend how many claims to expect so it can show a progress bar
                Map<String, Object> claimsCountData = new HashMap<>();
                claimsCountData.put("total", claims.size());
                sendEvent(emitter, "claims_count", objectMapper.writeValueAsString(claimsCountData));

                // Keep a record of all events so we can write demo-fallback.json at the end
                List<Map<String, Object>> events = new ArrayList<>();

                // Step 2: process each claim sequentially (embed → retrieve → score)
                for (Claim claim : claims) {
                    try {
                        // Embed the claim text to get a query vector
                        List<Double> vector = embedService.embedText(claim.getText());

                        // Find the most similar chunks in both corpora (publisher-aware if authenticated)
                        Map<String, List<ScoredChunk>> candidates;
                        if (publisherId != null && !publisherId.isBlank()) {
                            candidates = retrieveService.retrieveCandidates(vector, publisherId, 5);
                        } else {
                            candidates = retrieveService.retrieveCandidates(vector);
                        }
                        List<ScoredChunk> publisherHits = candidates.get("publisherHits");
                        List<ScoredChunk> referenceHits = candidates.get("referenceHits");

                        // Ask the LLM to score the claim against the retrieved passages
                        Map<String, Object> scoreResult = scoreService.scoreClaim(
                                claim.getText(), publisherHits, referenceHits);

                        // Extract the independent source count and fingerprint flag from the score result
                        @SuppressWarnings("unchecked")
                        Map<String, Object> exclusivity = (Map<String, Object>) scoreResult.get("exclusivity");
                        int independentSourceCount = exclusivity != null
                                ? ((Number) exclusivity.getOrDefault("independent_source_count", 0)).intValue()
                                : 0;

                        @SuppressWarnings("unchecked")
                        Map<String, Object> fingerprint = (Map<String, Object>) scoreResult.get("fingerprint");
                        boolean fingerprintDetected = fingerprint != null
                                && Boolean.TRUE.equals(fingerprint.get("detected"));

                        // Compute the final 0–1 exclusivity score
                        double exclusivityScore = scoreService.computeExclusivityScore(
                                independentSourceCount, fingerprintDetected);

                        // Build the event payload: claim metadata + full score result + numeric score
                        Map<String, Object> event = new LinkedHashMap<>();
                        event.put("claim_id", claim.getId());
                        event.put("claim_text", claim.getText());
                        event.put("mode", mode);
                        event.putAll(scoreResult); // spread match/exclusivity/fingerprint into the event
                        event.put("exclusivity_score", exclusivityScore);

                        events.add(Map.of("type", "claim_scored", "data", event));
                        sendEvent(emitter, "claim_scored", objectMapper.writeValueAsString(event));

                    } catch (Exception err) {
                        // Per-claim error: send a partial result and continue with remaining claims
                        Map<String, Object> errorEvent = new LinkedHashMap<>();
                        errorEvent.put("claim_id", claim.getId());
                        errorEvent.put("claim_text", claim.getText());
                        errorEvent.put("mode", mode);
                        errorEvent.put("scoring_failed", true);
                        errorEvent.put("error", err.getMessage());
                        errorEvent.put("exclusivity_score", 0);

                        events.add(Map.of("type", "claim_scored", "data", errorEvent));
                        sendEvent(emitter, "claim_scored", objectMapper.writeValueAsString(errorEvent));
                    }
                }

                // Signal the frontend that all claims have been streamed
                sendEvent(emitter, "done", "{}");
                emitter.complete();

                // Save the completed trace as demo-fallback.json for future mock replays
                try {
                    Map<String, Object> fallback = new LinkedHashMap<>();
                    fallback.put("question", question);
                    fallback.put("answer", answer);
                    fallback.put("mode", mode);
                    fallback.put("events", events);
                    File fallbackFile = new File(dataDir, "demo-fallback.json");
                    Files.write(fallbackFile.toPath(),
                            objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(fallback));
                } catch (Exception ignored) {
                    // Non-critical — failing to save the fallback doesn't affect the trace result
                }

            } catch (Exception err) {
                // Top-level failure: decompose failed or index not loaded
                try {
                    Map<String, Object> errorData = new HashMap<>();
                    errorData.put("error", err.getMessage());
                    sendEvent(emitter, "error", objectMapper.writeValueAsString(errorData));
                    emitter.complete();
                } catch (Exception e) {
                    emitter.completeWithError(e);
                }
            }
        });

        return emitter;
    }

    /**
     * Sends a single SSE event with a named type and pre-serialized JSON data string.
     * Calls completeWithError if the client has already disconnected (IOException).
     *
     * @param emitter  the SSE emitter for this request
     * @param type     the SSE event name (e.g. "claim_scored", "done")
     * @param data     the JSON string to send as the event data payload
     */
    private void sendEvent(SseEmitter emitter, String type, String data) {
        try {
            emitter.send(SseEmitter.event().name(type).data(data));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
    }
}
