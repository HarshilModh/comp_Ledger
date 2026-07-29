package com.compledger.controller;

import com.compledger.model.Claim;
import com.compledger.model.MultiTraceRequest;
import com.compledger.model.ScoredChunk;
import com.compledger.service.DecomposeService;
import com.compledger.service.EmbedService;
import com.compledger.service.GenerateService;
import com.compledger.service.RetrieveService;
import com.compledger.service.ScoreService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.task.TaskExecutor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.stream.Collectors;

@Tag(name = "Multi-Trace", description = "Compare answers from multiple AI models simultaneously (SSE)")
@RestController
public class MultiTraceController {

    private static final Logger logger = LoggerFactory.getLogger(MultiTraceController.class);

    @Autowired private GenerateService generateService;
    @Autowired private DecomposeService decomposeService;
    @Autowired private EmbedService embedService;
    @Autowired private RetrieveService retrieveService;
    @Autowired private ScoreService scoreService;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TaskExecutor taskExecutor;

    @Operation(
            summary = "List available models",
            description = "Returns the static list of Bedrock model IDs and display labels " +
                    "available for multi-model comparison. Used by the frontend to populate the model selection UI.")
    @ApiResponse(
            responseCode = "200",
            description = "List of available models",
            content = @Content(
                    mediaType = "application/json",
                    examples = @ExampleObject(value =
                            "{\"models\": [{\"id\": \"us.anthropic.claude-haiku-4-5-20251001-v1:0\", \"label\": \"Claude Haiku 4.5\"}, " +
                            "{\"id\": \"us.anthropic.claude-sonnet-4-5-20251001-v1:0\", \"label\": \"Claude Sonnet 4.5\"}]}")))
    @GetMapping("/api/models")
    public Map<String, Object> getModels() {
        Map<String, Object> result = new HashMap<>();
        result.put("models", GenerateService.AVAILABLE_MODELS);
        return result;
    }

    @Operation(
            summary = "Compare multiple models on one question (SSE)",
            description = """
                    Poses the same question to all selected models in parallel. For each model, \
                    generates an answer and traces all its claims against the corpus — all \
                    concurrently. Results are streamed as **Server-Sent Events** as each model \
                    completes, so the UI can display partial results without waiting for the slowest model.

                    **SSE event sequence:**
                    | Event | Payload | Description |
                    |---|---|---|
                    | `models` | `{"models": [{id, label}]}` | Which models are being compared |
                    | `model_start` | `{"modelId": "..."}` | A model began generating its answer |
                    | `model_answer` | `{"modelId": "...", "answer": "..."}` | Raw answer text from a model |
                    | `model_done` | `{"modelId": "...", "claims": [...]}` | All scored claims for a model |
                    | `model_error` | `{"modelId": "...", "error": "..."}` | A model failed (others continue) |
                    | `done` | `{}` | All models finished |
                    | `error` | `{"error": "..."}` | Top-level failure before any model started |

                    If `modelIds` is omitted or empty, **all** models returned by `GET /api/models` are used.
                    """)
    @ApiResponse(
            responseCode = "200",
            description = "SSE stream opened. Model events arrive as each model completes.",
            content = @Content(
                    mediaType = "text/event-stream",
                    examples = {
                            @ExampleObject(name = "models", value =
                                    "event: models\ndata: {\"models\": [{\"id\": \"us.anthropic.claude-haiku-4-5-20251001-v1:0\", \"label\": \"Claude Haiku 4.5\"}]}\n\n"),
                            @ExampleObject(name = "model_done", value =
                                    "event: model_done\ndata: {\"modelId\": \"us.anthropic.claude-haiku-4-5-20251001-v1:0\", " +
                                    "\"claims\": [{\"claim_id\": 1, \"claim_text\": \"OpenAI was founded in 2015.\", \"exclusivity_score\": 0.2}]}\n\n"),
                            @ExampleObject(name = "done", value =
                                    "event: done\ndata: {}\n\n")
                    }))
    @ApiResponse(responseCode = "500", description = "Server error before the SSE stream could be opened")
    @PostMapping("/api/multi-trace")
    public SseEmitter multiTrace(
            @org.springframework.web.bind.annotation.RequestBody
            @RequestBody(
                    description = "Question and optional subset of model IDs to compare",
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = MultiTraceRequest.class),
                            examples = {
                                    @ExampleObject(name = "All models", value =
                                            "{\"question\": \"What caused the 2008 financial crisis?\"}"),
                                    @ExampleObject(name = "Specific models", value =
                                            "{\"question\": \"What caused the 2008 financial crisis?\", " +
                                            "\"modelIds\": [\"us.anthropic.claude-haiku-4-5-20251001-v1:0\", " +
                                            "\"us.anthropic.claude-sonnet-4-5-20251001-v1:0\"]}")
                            }))
            MultiTraceRequest multiTraceRequest,
            @RequestAttribute(value = "publisherId", required = false) String publisherId) {
        SseEmitter emitter = new SseEmitter(300_000L);

        // Kick off all work in a background thread so the HTTP thread is freed immediately
        taskExecutor.execute(() -> {
            String question = multiTraceRequest.getQuestion();

            if (question == null || question.isBlank()) {
                try {
                    Map<String, Object> err = new HashMap<>();
                    err.put("error", "'question' field is required and must not be blank");
                    sendEvent(emitter, "error", objectMapper.writeValueAsString(err));
                    emitter.complete();
                } catch (Exception e) {
                    emitter.completeWithError(e);
                }
                return;
            }

            List<String> modelIds = multiTraceRequest.getModelIds();

            // Filter AVAILABLE_MODELS to only the requested IDs, or use all if none specified
            List<Map<String, String>> models;
            if (modelIds != null && !modelIds.isEmpty()) {
                final List<String> finalModelIds = modelIds;
                models = GenerateService.AVAILABLE_MODELS.stream()
                        .filter(m -> finalModelIds.contains(m.get("id")))
                        .collect(Collectors.toList());
            } else {
                models = GenerateService.AVAILABLE_MODELS;
            }

            try {
                // Tell the frontend which models will be sending results
                Map<String, Object> modelsEventData = new HashMap<>();
                List<Map<String, String>> modelList = models.stream()
                        .map(m -> {
                            Map<String, String> entry = new LinkedHashMap<>();
                            entry.put("id", m.get("id"));
                            entry.put("label", m.get("label"));
                            return entry;
                        })
                        .collect(Collectors.toList());
                modelsEventData.put("models", modelList);
                sendEvent(emitter, "models", objectMapper.writeValueAsString(modelsEventData));

                // Launch one CompletableFuture per model — all run in parallel
                Executor executor = (Executor) taskExecutor;
                List<CompletableFuture<Void>> futures = new ArrayList<>();

                for (Map<String, String> model : models) {
                    String modelId = model.get("id");
                    CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                        try {
                            // Signal that this model has started
                            Map<String, Object> startData = new HashMap<>();
                            startData.put("modelId", modelId);
                            sendEvent(emitter, "model_start", objectMapper.writeValueAsString(startData));

                            // Generate the model's answer to the question
                            String answer = generateService.generateAnswer(question, modelId);

                            // Stream the raw answer text to the UI immediately
                            Map<String, Object> answerData = new LinkedHashMap<>();
                            answerData.put("modelId", modelId);
                            answerData.put("answer", answer);
                            sendEvent(emitter, "model_answer", objectMapper.writeValueAsString(answerData));

                            // Decompose and score all claims in the answer (claims run in parallel inside traceAnswer)
                            List<Map<String, Object>> tracedClaims = traceAnswer(question, answer, publisherId);

                            // Send the complete scored claim list for this model
                            Map<String, Object> doneData = new LinkedHashMap<>();
                            doneData.put("modelId", modelId);
                            doneData.put("claims", tracedClaims);
                            sendEvent(emitter, "model_done", objectMapper.writeValueAsString(doneData));

                        } catch (Exception e) {
                            logger.error("Error processing model {}: {}", modelId, e.getMessage(), e);
                            try {
                                // Report per-model failure without stopping other models
                                Map<String, Object> errorData = new LinkedHashMap<>();
                                errorData.put("modelId", modelId);
                                errorData.put("error", e.getMessage());
                                sendEvent(emitter, "model_error", objectMapper.writeValueAsString(errorData));
                            } catch (Exception ex) {
                                logger.error("Failed to send model_error event: {}", ex.getMessage());
                            }
                        }
                    }, executor);
                    futures.add(future);
                }

                // Block until every model future has resolved (success or error)
                CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

                sendEvent(emitter, "done", "{}");
                emitter.complete();

            } catch (Exception e) {
                // Top-level failure before any model started (e.g. JSON serialization error)
                logger.error("Error in multi-trace: {}", e.getMessage(), e);
                try {
                    Map<String, Object> errorData = new HashMap<>();
                    errorData.put("error", e.getMessage());
                    sendEvent(emitter, "error", objectMapper.writeValueAsString(errorData));
                    emitter.complete();
                } catch (Exception ex) {
                    emitter.completeWithError(ex);
                }
            }
        });

        return emitter;
    }

    /**
     * Decomposes an answer into claims and scores all of them in parallel.
     *
     * Each claim gets its own CompletableFuture so embed + retrieve + score
     * run concurrently across the thread pool. allOf().join() waits for all
     * claims to finish before returning the combined results.
     *
     * @param question the original question (passed to decompose for context)
     * @param answer   the model-generated answer to decompose and score
     * @return list of scored claim maps in the same order as the decomposed claims
     */
    private List<Map<String, Object>> traceAnswer(String question, String answer, String publisherId) throws Exception {
        List<Claim> claims = decomposeService.decompose(question, answer);
        Executor executor = (Executor) taskExecutor;

        // Spawn one future per claim so all claims are scored concurrently
        List<CompletableFuture<Map<String, Object>>> claimFutures = claims.stream()
                .map(claim -> CompletableFuture.supplyAsync(() -> {
                    try {
                        // Embed → retrieve → score pipeline for a single claim
                        List<Double> vector = embedService.embedText(claim.getText());
                        Map<String, List<ScoredChunk>> candidates;
                        if (publisherId != null && !publisherId.isBlank()) {
                            candidates = retrieveService.retrieveCandidates(vector, publisherId, 5);
                        } else {
                            candidates = retrieveService.retrieveCandidates(vector);
                        }
                        List<ScoredChunk> publisherHits = candidates.get("publisherHits");
                        List<ScoredChunk> referenceHits = candidates.get("referenceHits");
                        Map<String, Object> scoreResult = scoreService.scoreClaim(
                                claim.getText(), publisherHits, referenceHits);

                        // Extract counts needed for the numeric score
                        @SuppressWarnings("unchecked")
                        Map<String, Object> exclusivity = (Map<String, Object>) scoreResult.get("exclusivity");
                        int independentSourceCount = exclusivity != null
                                ? ((Number) exclusivity.getOrDefault("independent_source_count", 0)).intValue()
                                : 0;

                        @SuppressWarnings("unchecked")
                        Map<String, Object> fingerprint = (Map<String, Object>) scoreResult.get("fingerprint");
                        boolean fingerprintDetected = fingerprint != null
                                && Boolean.TRUE.equals(fingerprint.get("detected"));

                        double exclusivityScore = scoreService.computeExclusivityScore(
                                independentSourceCount, fingerprintDetected);

                        // Build the result map that the frontend consumes
                        Map<String, Object> claimResult = new LinkedHashMap<>();
                        claimResult.put("claim_id", claim.getId());
                        claimResult.put("claim_text", claim.getText());
                        claimResult.putAll(scoreResult); // spread match/exclusivity/fingerprint
                        claimResult.put("exclusivity_score", exclusivityScore);
                        return claimResult;

                    } catch (Exception e) {
                        // Return a minimal error result rather than propagating — other claims continue
                        Map<String, Object> errorResult = new LinkedHashMap<>();
                        errorResult.put("claim_id", claim.getId());
                        errorResult.put("claim_text", claim.getText());
                        errorResult.put("scoring_failed", true);
                        errorResult.put("exclusivity_score", 0);
                        return errorResult;
                    }
                }, executor))
                .collect(Collectors.toList());

        // Wait for all claim futures to complete before returning
        CompletableFuture.allOf(claimFutures.toArray(new CompletableFuture[0])).join();

        // Collect results in original claim order
        List<Map<String, Object>> results = new ArrayList<>();
        for (CompletableFuture<Map<String, Object>> future : claimFutures) {
            results.add(future.join());
        }
        return results;
    }

    /**
     * Sends a single SSE event. Calls completeWithError if the client has disconnected.
     *
     * @param emitter  the SSE emitter for this request
     * @param type     the SSE event name (e.g. "model_done", "done")
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
