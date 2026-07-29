package com.compledger.controller;

import com.compledger.model.ArticleTraceRequest;
import com.compledger.model.Claim;
import com.compledger.model.ScoredChunk;
import com.compledger.service.DecomposeService;
import com.compledger.service.EmbedService;
import com.compledger.service.LiveVerifyService;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Handles POST /api/article-trace — lets a publisher submit a plain-text article
 * for pre-publication fact-checking.
 *
 * Each claim extracted from the article goes through two verification layers:
 *   1. Internal corpus (publisher archive + reference corpus) — existing pipeline
 *   2. Live external sources (GDELT + Wikipedia) — triggered when corpus has no hits
 *      or when live_verify=true is set on the request
 *
 * SSE event types:
 *   claims_count   - { total: N }
 *   claim_scored   - full scoring result + live verification for one claim
 *   done           - {}
 *   error          - { error: "..." }
 */
@Tag(name = "Article Trace", description = "Pre-publication fact-checking for publisher-submitted articles")
@RestController
public class ArticleTraceController {

    private static final Logger logger = LoggerFactory.getLogger(ArticleTraceController.class);

    @Autowired private DecomposeService decomposeService;
    @Autowired private EmbedService embedService;
    @Autowired private RetrieveService retrieveService;
    @Autowired private ScoreService scoreService;
    @Autowired private LiveVerifyService liveVerifyService;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TaskExecutor taskExecutor;

    @Operation(
            summary = "Fact-check a publisher article (SSE)",
            description = """
                    Accepts plain-text article content and fact-checks every claim it contains \
                    before publication. Designed for breaking news where speed matters.

                    **Two-layer verification per claim:**
                    1. **Internal corpus** — cosine similarity search against the publisher archive \
                    and reference corpus (AP, Reuters, BBC, etc.)
                    2. **Live external sources** — if the internal corpus has no hits, or if the \
                    claim's exclusivity score is low, it is also verified against:
                       - **GDELT** — monitors global news in 100+ languages, updated every 15 minutes
                       - **Wikipedia** — structured facts about people, organisations, and events

                    **Verdict per claim (`live_verification.verdict`):**
                    | Verdict | Meaning |
                    |---|---|
                    | `VERIFIED` | Multiple credible live sources confirm the claim |
                    | `UNVERIFIED` | No sources confirm the claim, or it contradicts sources |
                    | `CONFLICTING` | Live sources disagree with each other |
                    | `INSUFFICIENT_DATA` | Sources found but insufficient detail to judge |
                    | `SKIPPED` | Internal corpus had strong hits; live check was not needed |

                    **SSE event sequence:**
                    | Event | Payload |
                    |---|---|
                    | `claims_count` | `{"total": N}` |
                    | `claim_scored` | Full claim result including `live_verification` block |
                    | `done` | `{}` |
                    | `error` | `{"error": "..."}` |
                    """)
    @ApiResponse(
            responseCode = "200",
            description = "SSE stream opened. One `claim_scored` event per claim.",
            content = @Content(
                    mediaType = "text/event-stream",
                    examples = {
                            @ExampleObject(name = "claims_count", value =
                                    "event: claims_count\ndata: {\"total\": 5}\n\n"),
                            @ExampleObject(name = "claim_scored — verified", value =
                                    "event: claim_scored\ndata: {\"claim_id\": 1, " +
                                    "\"claim_text\": \"Prime Minister X died in a helicopter crash.\", " +
                                    "\"exclusivity_score\": 0.1, " +
                                    "\"live_verification\": {\"verdict\": \"VERIFIED\", \"confidence\": 0.9, " +
                                    "\"reasoning\": \"BBC, Reuters, and AP all confirm the death.\", " +
                                    "\"live_source_count\": 8, " +
                                    "\"sources\": [{\"title\": \"PM X dies in crash\", \"url\": \"https://bbc.com/...\", " +
                                    "\"domain\": \"bbc.com\", \"source_type\": \"GDELT\"}]}}\n\n"),
                            @ExampleObject(name = "claim_scored — unverified", value =
                                    "event: claim_scored\ndata: {\"claim_id\": 2, " +
                                    "\"claim_text\": \"The helicopter was shot down.\", " +
                                    "\"exclusivity_score\": 0.0, " +
                                    "\"live_verification\": {\"verdict\": \"UNVERIFIED\", \"confidence\": 0.8, " +
                                    "\"reasoning\": \"No source confirms the helicopter was shot down.\", " +
                                    "\"live_source_count\": 3, \"sources\": []}}\n\n"),
                            @ExampleObject(name = "done", value =
                                    "event: done\ndata: {}\n\n")
                    }))
    @ApiResponse(responseCode = "500", description = "Server error before the SSE stream could be opened")
    @PostMapping("/api/article-trace")
    public SseEmitter articleTrace(
            @org.springframework.web.bind.annotation.RequestBody
            @RequestBody(
                    description = "Plain-text article content and publisher metadata",
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = ArticleTraceRequest.class),
                            examples = @ExampleObject(value =
                                    "{\"article_text\": \"Prime Minister John Doe died Monday in a helicopter " +
                                    "crash near the capital. He was 67. The crash occurred at 14:30 local time " +
                                    "near Mount Kazbek. No survivors were found at the scene.\", " +
                                    "\"publisher_name\": \"Silicon Insider\"}")))
            ArticleTraceRequest articleTraceRequest) {

        SseEmitter emitter = new SseEmitter(300_000L);

        taskExecutor.execute(() -> {
            String articleText = articleTraceRequest.getArticleText();

            if (articleText == null || articleText.isBlank()) {
                try {
                    Map<String, Object> err = new HashMap<>();
                    err.put("error", "article_text is required and must not be empty");
                    sendEvent(emitter, "error", objectMapper.writeValueAsString(err));
                    emitter.complete();
                } catch (Exception e) {
                    emitter.completeWithError(e);
                }
                return;
            }

            try {
                // Decompose the article into atomic claims.
                // We pass a generic context question so the decompose prompt stays compatible.
                List<Claim> claims = decomposeService.decompose(
                        "What factual claims does this article make?", articleText);

                Map<String, Object> countData = new HashMap<>();
                countData.put("total", claims.size());
                sendEvent(emitter, "claims_count", objectMapper.writeValueAsString(countData));

                for (Claim claim : claims) {
                    try {
                        // Layer 1: internal corpus
                        List<Double> vector = embedService.embedText(claim.getText());
                        Map<String, List<ScoredChunk>> candidates = retrieveService.retrieveCandidates(vector);
                        List<ScoredChunk> publisherHits = candidates.get("publisherHits");
                        List<ScoredChunk> referenceHits = candidates.get("referenceHits");
                        Map<String, Object> scoreResult = scoreService.scoreClaim(
                                claim.getText(), publisherHits, referenceHits);

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

                        // Layer 2: live verification
                        // Run for every claim so the publisher sees live corroboration data.
                        // A claim with strong internal hits still benefits from live source URLs.
                        Map<String, Object> liveResult = liveVerifyService.verify(claim.getText());

                        Map<String, Object> event = new LinkedHashMap<>();
                        event.put("claim_id", claim.getId());
                        event.put("claim_text", claim.getText());
                        event.putAll(scoreResult);
                        event.put("exclusivity_score", exclusivityScore);
                        event.put("live_verification", liveResult);

                        sendEvent(emitter, "claim_scored", objectMapper.writeValueAsString(event));

                    } catch (Exception err) {
                        logger.error("Error scoring claim {}: {}", claim.getId(), err.getMessage(), err);
                        Map<String, Object> errorEvent = new LinkedHashMap<>();
                        errorEvent.put("claim_id", claim.getId());
                        errorEvent.put("claim_text", claim.getText());
                        errorEvent.put("scoring_failed", true);
                        errorEvent.put("error", err.getMessage());
                        errorEvent.put("exclusivity_score", 0);
                        sendEvent(emitter, "claim_scored", objectMapper.writeValueAsString(errorEvent));
                    }
                }

                sendEvent(emitter, "done", "{}");
                emitter.complete();

            } catch (Exception err) {
                logger.error("Article trace failed: {}", err.getMessage(), err);
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

    private void sendEvent(SseEmitter emitter, String type, String data) {
        try {
            emitter.send(SseEmitter.event().name(type).data(data));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
    }
}
