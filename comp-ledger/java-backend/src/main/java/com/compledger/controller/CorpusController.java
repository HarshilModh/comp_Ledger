package com.compledger.controller;

import com.compledger.model.Article;
import com.compledger.repository.CorpusRepository;
import com.compledger.service.IngestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "Corpus", description = "Publisher corpus management — ingest and manage articles")
@RestController
@RequestMapping("/api/corpus")
public class CorpusController {

    private static final Logger logger = LoggerFactory.getLogger(CorpusController.class);
    private static final int MAX_TEXT_LENGTH = 100_000;

    private final IngestService ingestService;
    private final CorpusRepository corpusRepository;

    public CorpusController(IngestService ingestService, CorpusRepository corpusRepository) {
        this.ingestService = ingestService;
        this.corpusRepository = corpusRepository;
    }

    @Operation(
            summary = "Ingest an article into the publisher's corpus",
            description = "Chunks the article text, embeds each chunk via Amazon Titan, and stores " +
                    "them in the publisher's isolated corpus. The article is then available for " +
                    "claim matching during trace operations.")
    @ApiResponse(responseCode = "201", description = "Article ingested successfully",
            content = @Content(mediaType = "application/json",
                    examples = @ExampleObject(value =
                            "{\"id\": \"uuid\", \"title\": \"...\", \"chunk_count\": 5, \"ingested_at\": \"...\"}")))
    @ApiResponse(responseCode = "400", description = "Validation error")
    @PostMapping("/ingest")
    public ResponseEntity<Map<String, Object>> ingest(
            @RequestBody Map<String, String> body,
            @RequestAttribute("publisherId") String publisherId) {

        String title = body.get("title");
        String text = body.get("text");
        String sourceUrl = body.get("source_url");

        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "'title' is required"));
        }
        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "'text' is required"));
        }
        if (text.length() > MAX_TEXT_LENGTH) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Article text exceeds maximum length of " + MAX_TEXT_LENGTH + " characters"));
        }

        try {
            Article article = ingestService.ingest(publisherId, title, text, sourceUrl);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", article.getId());
            response.put("title", article.getTitle());
            response.put("source_url", article.getSourceUrl());
            response.put("chunk_count", article.getChunkCount());
            response.put("ingested_at", article.getIngestedAt().toString());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            logger.error("Ingestion failed for publisher {}: {}", publisherId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Ingestion failed: " + e.getMessage()));
        }
    }

    @Operation(summary = "List all articles in the publisher's corpus")
    @ApiResponse(responseCode = "200", description = "List of ingested articles")
    @GetMapping("/articles")
    public ResponseEntity<Map<String, Object>> listArticles(@RequestAttribute("publisherId") String publisherId) {
        List<Article> articles = corpusRepository.listArticles(publisherId);
        List<Map<String, Object>> mapped = articles.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("title", a.getTitle());
            m.put("source_url", a.getSourceUrl());
            m.put("chunk_count", a.getChunkCount());
            m.put("ingested_at", a.getIngestedAt() != null ? a.getIngestedAt().toString() : null);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("articles", mapped, "total", mapped.size()));
    }

    @Operation(summary = "Delete an article from the publisher's corpus")
    @ApiResponse(responseCode = "200", description = "Article deleted")
    @ApiResponse(responseCode = "404", description = "Article not found")
    @DeleteMapping("/articles/{articleId}")
    public ResponseEntity<Map<String, Object>> deleteArticle(
            @PathVariable String articleId,
            @RequestAttribute("publisherId") String publisherId) {

        if (corpusRepository.findArticleById(publisherId, articleId).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Article not found"));
        }

        corpusRepository.deleteArticle(publisherId, articleId);
        return ResponseEntity.ok(Map.of("deleted", articleId));
    }
}
