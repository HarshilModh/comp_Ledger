package com.compledger.service;

import com.compledger.model.Article;
import com.compledger.model.SourceConnector;
import com.compledger.model.SyncJob;
import com.compledger.repository.ConnectorRepository;
import com.compledger.repository.CorpusRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

/**
 * Service that syncs articles from a publisher's external API into our corpus.
 *
 * This is the core engine behind the "pull-based" bulk ingestion feature.
 * When triggered (manually or by scheduler), it:
 *   1. Reads the connector configuration (URL, auth, field mappings)
 *   2. Fetches articles page by page from the publisher's API
 *   3. Extracts title + body using the configured field mappings
 *   4. Delegates to IngestService for chunking + embedding + storage
 *   5. Records progress in a SyncJob for UI visibility
 *
 * The service is designed to be fault-tolerant:
 *   - Individual article failures don't stop the sync
 *   - Rate limiting is handled with configurable delays
 *   - Already-ingested articles are detected and skipped
 *
 * Threading: sync runs asynchronously via @Async so it doesn't block the
 * HTTP request that triggered it. The SyncJob record acts as the communication
 * channel between the background worker and the UI polling for status.
 */
@Service
public class ConnectorSyncService {

    private static final Logger logger = LoggerFactory.getLogger(ConnectorSyncService.class);

    /**
     * Delay between page fetches to avoid overwhelming the publisher's API.
     * Most publisher APIs have rate limits of 5-10 req/sec.
     */
    private static final long PAGE_DELAY_MS = 1000;

    /**
     * Delay between individual article detail fetches (when detailEndpoint is configured).
     * More conservative because detail endpoints are heavier.
     */
    private static final long ARTICLE_DELAY_MS = 500;

    /** HTTP client reused across all sync operations for connection pooling */
    private final HttpClient httpClient;

    private final ConnectorRepository connectorRepository;
    private final CorpusRepository corpusRepository;
    private final IngestService ingestService;
    private final ObjectMapper objectMapper;

    public ConnectorSyncService(
            ConnectorRepository connectorRepository,
            CorpusRepository corpusRepository,
            IngestService ingestService,
            ObjectMapper objectMapper) {
        this.connectorRepository = connectorRepository;
        this.corpusRepository = corpusRepository;
        this.ingestService = ingestService;
        this.objectMapper = objectMapper;

        // Build a shared HTTP client with sensible timeouts
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Triggers an async sync for a specific connector.
     *
     * Creates a SyncJob record immediately (so the UI can show "RUNNING"),
     * then runs the actual fetch loop in a background thread.
     *
     * @param connector the connector configuration to sync
     * @return the created SyncJob (status=RUNNING) for immediate UI feedback
     */
    @Async
    public SyncJob triggerSync(SourceConnector connector) {
        // Create a new job record to track this sync run
        SyncJob job = new SyncJob();
        job.setId(UUID.randomUUID().toString());
        job.setConnectorId(connector.getId());
        job.setPublisherId(connector.getPublisherId());
        job.setStatus("RUNNING");
        job.setStartedAt(Instant.now());
        job.setProgressMessage("Starting sync...");
        connectorRepository.saveSyncJob(job);

        // Update connector status to SYNCING
        connector.setStatus("SYNCING");
        connectorRepository.saveConnector(connector);

        try {
            // Execute the actual sync loop
            executeSyncLoop(connector, job);

            // Mark job as completed
            job.setStatus("COMPLETED");
            job.setCompletedAt(Instant.now());
            job.setProgressMessage("Sync completed successfully");
            connectorRepository.saveSyncJob(job);

            // Update connector with sync results
            connector.setStatus("ACTIVE");
            connector.setLastSyncAt(Instant.now());
            connector.setLastSyncCount(job.getArticlesIngested());
            connector.setLastError(null);
            connector.setUpdatedAt(Instant.now());
            connectorRepository.saveConnector(connector);

            logger.info("Sync completed for connector '{}': {} ingested, {} skipped, {} failed",
                    connector.getName(), job.getArticlesIngested(), job.getArticlesSkipped(), job.getArticlesFailed());

        } catch (Exception e) {
            // Mark job as failed
            logger.error("Sync failed for connector '{}': {}", connector.getName(), e.getMessage(), e);
            job.setStatus("FAILED");
            job.setCompletedAt(Instant.now());
            job.setErrorMessage(e.getMessage());
            connectorRepository.saveSyncJob(job);

            // Update connector status to ERROR
            connector.setStatus("ERROR");
            connector.setLastError(e.getMessage());
            connector.setUpdatedAt(Instant.now());
            connectorRepository.saveConnector(connector);
        }

        return job;
    }

    /**
     * Core sync loop: fetches pages of articles from the publisher's API
     * and ingests each one into our corpus.
     *
     * Handles three pagination strategies:
     *   - OFFSET: increments by pageSize each iteration
     *   - PAGE: increments page number by 1
     *   - CURSOR: reads next cursor from response, passes it to next request
     *   - NONE: single request, no pagination
     *
     * @param connector the connector with URL/auth/pagination config
     * @param job the SyncJob record to update with progress
     */
    private void executeSyncLoop(SourceConnector connector, SyncJob job) throws Exception {
        int totalIngested = 0;
        int totalSkipped = 0;
        int totalFailed = 0;
        int totalFound = 0;
        int page = 0;
        int offset = 0;
        String cursor = null;
        boolean hasMore = true;

        // Determine max articles (0 = unlimited, use Integer.MAX_VALUE)
        int maxArticles = connector.getMaxArticles() > 0 ? connector.getMaxArticles() : Integer.MAX_VALUE;

        while (hasMore && totalFound < maxArticles) {
            // Build the URL for this page based on pagination type
            String url = buildPageUrl(connector, page, offset, cursor);
            logger.debug("Fetching page {} from: {}", page, url);

            // Make the HTTP request to the publisher's API
            HttpResponse<String> response = makeAuthenticatedRequest(connector, url);

            // Check for HTTP errors
            if (response.statusCode() != 200) {
                throw new RuntimeException("Publisher API returned HTTP " + response.statusCode() +
                        " for URL: " + url + " — Body: " + response.body().substring(0, Math.min(200, response.body().length())));
            }

            // Parse the JSON response
            JsonNode rootNode = objectMapper.readTree(response.body());

            // Navigate to the articles array using the configured JSON path
            JsonNode articlesNode = navigateJsonPath(rootNode, connector.getArticlesJsonPath());

            // If the articles node isn't an array, we're done
            if (articlesNode == null || !articlesNode.isArray() || articlesNode.isEmpty()) {
                hasMore = false;
                break;
            }

            // Process each article in this page
            for (JsonNode articleNode : articlesNode) {
                if (totalFound >= maxArticles) break;
                totalFound++;

                try {
                    // Extract fields using configured dot-notation paths
                    String title = extractField(articleNode, connector.getFieldMappings().get("title"));
                    String body = extractField(articleNode, connector.getFieldMappings().get("body"));
                    String articleUrl = extractField(articleNode, connector.getFieldMappings().get("url"));

                    // If we need to fetch the full article body from a detail endpoint
                    if ((body == null || body.isBlank()) && connector.getDetailEndpoint() != null) {
                        String articleId = extractField(articleNode, connector.getFieldMappings().get("id"));
                        if (articleId != null) {
                            body = fetchArticleDetail(connector, articleId);
                            Thread.sleep(ARTICLE_DELAY_MS);
                        }
                    }

                    // Skip articles without title or body (can't index them)
                    if (title == null || title.isBlank() || body == null || body.isBlank()) {
                        totalSkipped++;
                        continue;
                    }

                    // Skip articles that are too short to be meaningful (< 50 words)
                    if (body.split("\\s+").length < 50) {
                        totalSkipped++;
                        continue;
                    }

                    // Check if article already exists (by title match — simple dedup)
                    if (isAlreadyIngested(connector.getPublisherId(), title)) {
                        totalSkipped++;
                        continue;
                    }

                    // Ingest the article (chunk → embed → store)
                    ingestService.ingest(connector.getPublisherId(), title, body, articleUrl);
                    totalIngested++;

                } catch (Exception e) {
                    // Log and continue — one bad article shouldn't stop the whole sync
                    logger.warn("Failed to ingest article from connector '{}': {}",
                            connector.getName(), e.getMessage());
                    totalFailed++;
                }
            }

            // Update job progress after each page (UI can poll for this)
            job.setArticlesFound(totalFound);
            job.setArticlesIngested(totalIngested);
            job.setArticlesFailed(totalFailed);
            job.setArticlesSkipped(totalSkipped);
            job.setProgressMessage(String.format("Processing page %d — %d ingested, %d skipped",
                    page + 1, totalIngested, totalSkipped));
            connectorRepository.saveSyncJob(job);

            // Determine if there are more pages
            hasMore = determineHasMore(connector, articlesNode, rootNode);

            // Advance pagination state
            if (hasMore) {
                page++;
                offset += connector.getPageSize();
                if ("CURSOR".equals(connector.getPaginationType())) {
                    cursor = extractCursor(rootNode, connector.getCursorJsonPath());
                    if (cursor == null) hasMore = false; // No next cursor means end of data
                }
            }

            // Rate limiting: pause between pages to respect publisher API limits
            Thread.sleep(PAGE_DELAY_MS);
        }

        // Final stats update
        job.setArticlesFound(totalFound);
        job.setArticlesIngested(totalIngested);
        job.setArticlesFailed(totalFailed);
        job.setArticlesSkipped(totalSkipped);
    }

    /**
     * Builds the full URL for a page request, substituting pagination placeholders.
     *
     * Supported placeholders in listEndpoint:
     *   {page}     — current page number (0-based)
     *   {offset}   — current offset (page * pageSize)
     *   {cursor}   — cursor token from previous response
     *   {pageSize} — configured page size
     */
    private String buildPageUrl(SourceConnector connector, int page, int offset, String cursor) {
        String endpoint = connector.getListEndpoint();

        // Replace pagination placeholders
        endpoint = endpoint.replace("{page}", String.valueOf(page));
        endpoint = endpoint.replace("{offset}", String.valueOf(offset));
        endpoint = endpoint.replace("{pageSize}", String.valueOf(connector.getPageSize()));

        // Handle cursor pagination — append as query param
        if (cursor != null && connector.getCursorParam() != null) {
            String separator = endpoint.contains("?") ? "&" : "?";
            endpoint = endpoint + separator + connector.getCursorParam() + "=" + cursor;
        }

        // Combine base URL + endpoint, handling trailing/leading slashes
        String base = connector.getBaseUrl().replaceAll("/$", "");
        if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
        return base + endpoint;
    }

    /**
     * Makes an HTTP GET request with the connector's configured authentication.
     *
     * Supports four auth types:
     *   - API_KEY: adds the key as a custom header (e.g., "api-key: xxx")
     *   - BEARER: adds "Authorization: Bearer xxx"
     *   - BASIC: adds "Authorization: Basic base64(xxx)"
     *   - NONE: no auth headers
     */
    private HttpResponse<String> makeAuthenticatedRequest(SourceConnector connector, String url) throws Exception {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .GET();

        // Add authentication header based on connector's auth type
        String authType = connector.getAuthType();
        if ("API_KEY".equals(authType) && connector.getAuthHeader() != null) {
            // Custom header with raw value (e.g., "api-key: nyt_secret_123")
            requestBuilder.header(connector.getAuthHeader(), connector.getAuthValue());
        } else if ("BEARER".equals(authType)) {
            // Standard Bearer token auth
            requestBuilder.header("Authorization", "Bearer " + connector.getAuthValue());
        } else if ("BASIC".equals(authType)) {
            // HTTP Basic auth: base64-encode "username:password"
            String encoded = Base64.getEncoder().encodeToString(connector.getAuthValue().getBytes());
            requestBuilder.header("Authorization", "Basic " + encoded);
        }
        // NONE: no auth headers added

        // Always accept JSON responses
        requestBuilder.header("Accept", "application/json");

        return httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
    }

    /**
     * Navigates a JSON tree using dot-notation path.
     *
     * For example, path "response.docs" on {"response": {"docs": [...]}}
     * would return the array node.
     *
     * @param root the root JSON node to navigate from
     * @param path dot-separated path (null or empty returns root)
     * @return the node at the path, or null if path doesn't resolve
     */
    private JsonNode navigateJsonPath(JsonNode root, String path) {
        if (path == null || path.isBlank()) return root;

        JsonNode current = root;
        for (String segment : path.split("\\.")) {
            if (current == null) return null;
            current = current.get(segment);
        }
        return current;
    }

    /**
     * Extracts a text field from an article JSON node using dot-notation path.
     *
     * Handles nested paths like "headline.main" by traversing object nodes.
     * Returns null if the field is missing or not a text value.
     */
    private String extractField(JsonNode articleNode, String fieldPath) {
        if (fieldPath == null || fieldPath.isBlank()) return null;

        JsonNode current = articleNode;
        for (String segment : fieldPath.split("\\.")) {
            if (current == null) return null;
            current = current.get(segment);
        }

        if (current == null || current.isNull()) return null;
        return current.isTextual() ? current.asText() : current.toString();
    }

    /**
     * Fetches the full article body from the detail endpoint.
     *
     * Used when the list endpoint only returns summaries/excerpts and the
     * full text requires a separate API call per article.
     */
    private String fetchArticleDetail(SourceConnector connector, String articleId) throws Exception {
        String endpoint = connector.getDetailEndpoint().replace("{articleId}", articleId);
        String base = connector.getBaseUrl().replaceAll("/$", "");
        if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
        String url = base + endpoint;

        HttpResponse<String> response = makeAuthenticatedRequest(connector, url);
        if (response.statusCode() != 200) return null;

        JsonNode root = objectMapper.readTree(response.body());
        // Try to extract body using field mapping
        return extractField(root, connector.getFieldMappings().get("body"));
    }

    /**
     * Simple deduplication check: looks for an existing article with the same title.
     *
     * This is a basic approach — for production, consider hashing the article body
     * or using the publisher's article ID for more reliable dedup.
     */
    private boolean isAlreadyIngested(String publisherId, String title) {
        return corpusRepository.listArticles(publisherId).stream()
                .anyMatch(a -> title.equals(a.getTitle()));
    }

    /**
     * Determines whether there are more pages to fetch.
     *
     * Logic depends on pagination type:
     *   - NONE: always false (single page)
     *   - PAGE/OFFSET: true if the current page returned a full page of results
     *   - CURSOR: true if a next cursor exists in the response
     */
    private boolean determineHasMore(SourceConnector connector, JsonNode articlesNode, JsonNode rootNode) {
        String paginationType = connector.getPaginationType();

        if ("NONE".equals(paginationType)) return false;

        if ("CURSOR".equals(paginationType)) {
            // Check if a next cursor is present
            String nextCursor = extractCursor(rootNode, connector.getCursorJsonPath());
            return nextCursor != null && !nextCursor.isBlank();
        }

        // For PAGE and OFFSET: if we got fewer articles than pageSize, we're done
        return articlesNode.size() >= connector.getPageSize();
    }

    /**
     * Extracts the pagination cursor from the API response.
     * Used for CURSOR-based pagination where the next page token is
     * embedded in the current response.
     */
    private String extractCursor(JsonNode rootNode, String cursorPath) {
        if (cursorPath == null || cursorPath.isBlank()) return null;
        JsonNode cursorNode = navigateJsonPath(rootNode, cursorPath);
        if (cursorNode == null || cursorNode.isNull()) return null;
        return cursorNode.asText();
    }

    /**
     * Tests a connector's configuration by making a single request to the list endpoint.
     *
     * Used by the UI "Test Connection" button to verify the URL and auth are correct
     * before saving the connector and triggering a full sync.
     *
     * @param connector the connector config to test
     * @return a map with "success" (boolean), "message" (string), and optionally "sample_count" (int)
     */
    public Map<String, Object> testConnection(SourceConnector connector) {
        try {
            // Build URL for first page
            String url = buildPageUrl(connector, 0, 0, null);

            // Make the request
            HttpResponse<String> response = makeAuthenticatedRequest(connector, url);

            if (response.statusCode() != 200) {
                return Map.of(
                        "success", false,
                        "message", "API returned HTTP " + response.statusCode()
                );
            }

            // Try to parse the response and find articles
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode articles = navigateJsonPath(root, connector.getArticlesJsonPath());

            if (articles == null || !articles.isArray()) {
                return Map.of(
                        "success", false,
                        "message", "Could not find articles array at path '" + connector.getArticlesJsonPath() + "'"
                );
            }

            // Try to extract fields from the first article as a sanity check
            if (articles.size() > 0) {
                JsonNode first = articles.get(0);
                String title = extractField(first, connector.getFieldMappings().get("title"));
                String body = extractField(first, connector.getFieldMappings().get("body"));

                if (title == null || title.isBlank()) {
                    return Map.of(
                            "success", false,
                            "message", "Connected successfully but 'title' field mapping didn't match. Check path: " +
                                    connector.getFieldMappings().get("title")
                    );
                }

                return Map.of(
                        "success", true,
                        "message", "Connection successful! Found " + articles.size() + " articles. " +
                                "Sample title: \"" + title.substring(0, Math.min(60, title.length())) + "...\"",
                        "sample_count", articles.size(),
                        "has_body", body != null && !body.isBlank()
                );
            }

            return Map.of(
                    "success", true,
                    "message", "Connected successfully but no articles found in response",
                    "sample_count", 0
            );

        } catch (Exception e) {
            return Map.of(
                    "success", false,
                    "message", "Connection failed: " + e.getMessage()
            );
        }
    }
}
