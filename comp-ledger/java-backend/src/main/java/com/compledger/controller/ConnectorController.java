package com.compledger.controller;

import com.compledger.model.SourceConnector;
import com.compledger.model.SyncJob;
import com.compledger.repository.ConnectorRepository;
import com.compledger.service.ConnectorSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST controller for managing publisher API source connectors.
 *
 * Publishers use these endpoints to:
 *   1. Configure their content API (URL, auth, field mappings)
 *   2. Test the connection before committing
 *   3. Trigger a sync to pull and index all their articles
 *   4. Monitor sync progress and history
 *   5. Pause, resume, or delete connectors
 *
 * All endpoints are authenticated — the publisher's ID comes from the
 * ApiKeyFilter via the "publisherId" request attribute.
 */
@Tag(name = "Connectors", description = "Publisher API source connectors for bulk article ingestion")
@RestController
@RequestMapping("/api/connectors")
public class ConnectorController {

    private static final Logger logger = LoggerFactory.getLogger(ConnectorController.class);

    private final ConnectorRepository connectorRepository;
    private final ConnectorSyncService syncService;

    public ConnectorController(ConnectorRepository connectorRepository, ConnectorSyncService syncService) {
        this.connectorRepository = connectorRepository;
        this.syncService = syncService;
    }

    /**
     * Creates a new source connector configuration.
     *
     * The publisher provides their API details (URL, auth, field mappings)
     * and we store them for later sync operations. The connector starts in
     * ACTIVE status but no sync is triggered automatically — the publisher
     * should test the connection first, then manually trigger the first sync.
     */
    @Operation(
            summary = "Create a new source connector",
            description = "Configures a connection to the publisher's content API. " +
                    "Provide the base URL, authentication details, pagination config, " +
                    "and field mappings that tell us where to find article title, body, and URL " +
                    "in the API response.")
    @ApiResponse(responseCode = "201", description = "Connector created successfully")
    @ApiResponse(responseCode = "400", description = "Validation error")
    @PostMapping
    public ResponseEntity<Map<String, Object>> createConnector(
            @RequestBody Map<String, Object> body,
            @RequestAttribute("publisherId") String publisherId) {

        // Validate required fields
        String name = getStr(body, "name");
        String baseUrl = getStr(body, "base_url");
        String authType = getStr(body, "auth_type");
        String listEndpoint = getStr(body, "list_endpoint");

        if (name == null || name.isBlank()) {
            return badRequest("'name' is required");
        }
        if (baseUrl == null || baseUrl.isBlank()) {
            return badRequest("'base_url' is required");
        }
        if (listEndpoint == null || listEndpoint.isBlank()) {
            return badRequest("'list_endpoint' is required");
        }

        // Validate auth type
        if (authType == null) authType = "NONE";
        if (!Set.of("API_KEY", "BEARER", "BASIC", "NONE").contains(authType)) {
            return badRequest("'auth_type' must be one of: API_KEY, BEARER, BASIC, NONE");
        }

        // If auth is required, validate credentials are provided
        if (!"NONE".equals(authType)) {
            if (getStr(body, "auth_value") == null || getStr(body, "auth_value").isBlank()) {
                return badRequest("'auth_value' is required when auth_type is not NONE");
            }
        }

        // Validate field mappings (at minimum, title and body must be mapped)
        @SuppressWarnings("unchecked")
        Map<String, String> fieldMappings = (Map<String, String>) body.get("field_mappings");
        if (fieldMappings == null || !fieldMappings.containsKey("title") || !fieldMappings.containsKey("body")) {
            return badRequest("'field_mappings' must include at least 'title' and 'body' paths");
        }

        // Build the connector model
        SourceConnector connector = new SourceConnector();
        connector.setId(UUID.randomUUID().toString());
        connector.setPublisherId(publisherId);
        connector.setName(name);
        connector.setBaseUrl(baseUrl);
        connector.setAuthType(authType);
        connector.setAuthHeader(getStr(body, "auth_header"));
        connector.setAuthValue(getStr(body, "auth_value"));
        connector.setListEndpoint(listEndpoint);
        connector.setDetailEndpoint(getStr(body, "detail_endpoint"));
        connector.setArticlesJsonPath(getStr(body, "articles_json_path"));
        connector.setFieldMappings(fieldMappings);

        // Pagination config with sensible defaults
        String paginationType = getStr(body, "pagination_type");
        connector.setPaginationType(paginationType != null ? paginationType : "NONE");
        connector.setCursorJsonPath(getStr(body, "cursor_json_path"));
        connector.setCursorParam(getStr(body, "cursor_param"));

        Object pageSizeObj = body.get("page_size");
        connector.setPageSize(pageSizeObj != null ? ((Number) pageSizeObj).intValue() : 50);

        Object maxArticlesObj = body.get("max_articles");
        connector.setMaxArticles(maxArticlesObj != null ? ((Number) maxArticlesObj).intValue() : 0);

        // Set initial status and timestamps
        connector.setStatus("ACTIVE");
        connector.setCreatedAt(Instant.now());
        connector.setUpdatedAt(Instant.now());

        // Persist to DynamoDB
        connectorRepository.saveConnector(connector);

        logger.info("Connector '{}' created for publisher {}", name, publisherId);
        return ResponseEntity.status(HttpStatus.CREATED).body(connectorToMap(connector));
    }

    /**
     * Lists all connectors for the authenticated publisher.
     * Returns connector configs with their current sync status.
     */
    @Operation(summary = "List all connectors", description = "Returns all configured API source connectors for this publisher")
    @GetMapping
    public ResponseEntity<Map<String, Object>> listConnectors(@RequestAttribute("publisherId") String publisherId) {
        List<SourceConnector> connectors = connectorRepository.listConnectors(publisherId);
        List<Map<String, Object>> mapped = connectors.stream()
                .map(this::connectorToMap)
                .collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("connectors", mapped, "total", mapped.size()));
    }

    /**
     * Gets a specific connector's full configuration.
     * Includes last sync status and error info if applicable.
     */
    @Operation(summary = "Get connector details")
    @GetMapping("/{connectorId}")
    public ResponseEntity<Map<String, Object>> getConnector(
            @PathVariable String connectorId,
            @RequestAttribute("publisherId") String publisherId) {

        Optional<SourceConnector> opt = connectorRepository.findConnectorById(publisherId, connectorId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Connector not found"));
        }
        return ResponseEntity.ok(connectorToMap(opt.get()));
    }

    /**
     * Updates an existing connector's configuration.
     * Only updates fields that are present in the request body.
     */
    @Operation(summary = "Update connector configuration")
    @PutMapping("/{connectorId}")
    public ResponseEntity<Map<String, Object>> updateConnector(
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute("publisherId") String publisherId) {

        Optional<SourceConnector> opt = connectorRepository.findConnectorById(publisherId, connectorId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Connector not found"));
        }

        SourceConnector connector = opt.get();

        // Update only provided fields (partial update)
        if (body.containsKey("name")) connector.setName(getStr(body, "name"));
        if (body.containsKey("base_url")) connector.setBaseUrl(getStr(body, "base_url"));
        if (body.containsKey("auth_type")) connector.setAuthType(getStr(body, "auth_type"));
        if (body.containsKey("auth_header")) connector.setAuthHeader(getStr(body, "auth_header"));
        if (body.containsKey("auth_value")) connector.setAuthValue(getStr(body, "auth_value"));
        if (body.containsKey("list_endpoint")) connector.setListEndpoint(getStr(body, "list_endpoint"));
        if (body.containsKey("detail_endpoint")) connector.setDetailEndpoint(getStr(body, "detail_endpoint"));
        if (body.containsKey("articles_json_path")) connector.setArticlesJsonPath(getStr(body, "articles_json_path"));
        if (body.containsKey("pagination_type")) connector.setPaginationType(getStr(body, "pagination_type"));
        if (body.containsKey("cursor_json_path")) connector.setCursorJsonPath(getStr(body, "cursor_json_path"));
        if (body.containsKey("cursor_param")) connector.setCursorParam(getStr(body, "cursor_param"));
        if (body.containsKey("page_size")) connector.setPageSize(((Number) body.get("page_size")).intValue());
        if (body.containsKey("max_articles")) connector.setMaxArticles(((Number) body.get("max_articles")).intValue());

        @SuppressWarnings("unchecked")
        Map<String, String> fieldMappings = (Map<String, String>) body.get("field_mappings");
        if (fieldMappings != null) connector.setFieldMappings(fieldMappings);

        connector.setUpdatedAt(Instant.now());
        connectorRepository.saveConnector(connector);

        return ResponseEntity.ok(connectorToMap(connector));
    }

    /**
     * Deletes a connector and all its sync history.
     * Does NOT delete articles that were already ingested — those remain in the corpus.
     */
    @Operation(summary = "Delete a connector", description = "Removes the connector config and sync history. Already-ingested articles are preserved.")
    @DeleteMapping("/{connectorId}")
    public ResponseEntity<Map<String, Object>> deleteConnector(
            @PathVariable String connectorId,
            @RequestAttribute("publisherId") String publisherId) {

        Optional<SourceConnector> opt = connectorRepository.findConnectorById(publisherId, connectorId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Connector not found"));
        }

        connectorRepository.deleteConnector(publisherId, connectorId);
        return ResponseEntity.ok(Map.of("deleted", connectorId));
    }

    /**
     * Tests a connector's configuration by making a single request to the publisher's API.
     *
     * This allows publishers to verify their URL, auth, and field mappings are correct
     * before triggering a full sync that could process thousands of articles.
     */
    @Operation(
            summary = "Test connector connection",
            description = "Makes a single request to the publisher's API to verify configuration. " +
                    "Returns success/failure with diagnostic info.")
    @PostMapping("/{connectorId}/test")
    public ResponseEntity<Map<String, Object>> testConnector(
            @PathVariable String connectorId,
            @RequestAttribute("publisherId") String publisherId) {

        Optional<SourceConnector> opt = connectorRepository.findConnectorById(publisherId, connectorId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Connector not found"));
        }

        Map<String, Object> result = syncService.testConnection(opt.get());
        return ResponseEntity.ok(result);
    }

    /**
     * Triggers a sync for a connector — fetches and indexes all articles from the publisher's API.
     *
     * The sync runs asynchronously in the background. This endpoint returns immediately
     * with the SyncJob ID, which can be polled via GET /api/connectors/{id}/jobs/{jobId}
     * to check progress.
     *
     * Refuses to sync if the connector is already syncing (prevents duplicate runs).
     */
    @Operation(
            summary = "Trigger sync",
            description = "Starts fetching articles from the publisher's API in the background. " +
                    "Returns immediately with a job ID for progress tracking.")
    @PostMapping("/{connectorId}/sync")
    public ResponseEntity<Map<String, Object>> triggerSync(
            @PathVariable String connectorId,
            @RequestAttribute("publisherId") String publisherId) {

        Optional<SourceConnector> opt = connectorRepository.findConnectorById(publisherId, connectorId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Connector not found"));
        }

        SourceConnector connector = opt.get();

        // Prevent duplicate syncs
        if ("SYNCING".equals(connector.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Connector is already syncing. Wait for the current sync to complete."));
        }

        // Trigger the async sync
        SyncJob job = syncService.triggerSync(connector);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("job_id", job.getId());
        response.put("connector_id", connectorId);
        response.put("status", "RUNNING");
        response.put("message", "Sync started. Poll GET /api/connectors/" + connectorId + "/jobs/" + job.getId() + " for progress.");

        return ResponseEntity.accepted().body(response);
    }

    /**
     * Lists recent sync jobs for a connector.
     * Shows history of past sync runs with their results.
     */
    @Operation(summary = "List sync jobs", description = "Returns the most recent sync jobs for a connector")
    @GetMapping("/{connectorId}/jobs")
    public ResponseEntity<Map<String, Object>> listSyncJobs(
            @PathVariable String connectorId,
            @RequestAttribute("publisherId") String publisherId,
            @RequestParam(defaultValue = "10") int limit) {

        // Verify the connector belongs to this publisher
        Optional<SourceConnector> opt = connectorRepository.findConnectorById(publisherId, connectorId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Connector not found"));
        }

        List<SyncJob> jobs = connectorRepository.listSyncJobs(connectorId, limit);
        List<Map<String, Object>> mapped = jobs.stream()
                .map(this::jobToMap)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("jobs", mapped, "total", mapped.size()));
    }

    /**
     * Gets a specific sync job's current status and progress.
     * The UI polls this endpoint while a sync is running to show progress.
     */
    @Operation(summary = "Get sync job status")
    @GetMapping("/{connectorId}/jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> getSyncJob(
            @PathVariable String connectorId,
            @PathVariable String jobId,
            @RequestAttribute("publisherId") String publisherId) {

        // Verify the connector belongs to this publisher
        Optional<SourceConnector> opt = connectorRepository.findConnectorById(publisherId, connectorId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Connector not found"));
        }

        Optional<SyncJob> jobOpt = connectorRepository.findSyncJobById(connectorId, jobId);
        if (jobOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Job not found"));
        }

        return ResponseEntity.ok(jobToMap(jobOpt.get()));
    }

    // ===================== Helper Methods =====================

    /** Converts a SourceConnector to a response map (hides sensitive auth value) */
    private Map<String, Object> connectorToMap(SourceConnector c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("name", c.getName());
        map.put("base_url", c.getBaseUrl());
        map.put("auth_type", c.getAuthType());
        map.put("auth_header", c.getAuthHeader());
        // Mask the auth value for security — only show last 4 chars
        map.put("auth_value_masked", maskSecret(c.getAuthValue()));
        map.put("list_endpoint", c.getListEndpoint());
        map.put("detail_endpoint", c.getDetailEndpoint());
        map.put("articles_json_path", c.getArticlesJsonPath());
        map.put("field_mappings", c.getFieldMappings());
        map.put("pagination_type", c.getPaginationType());
        map.put("cursor_json_path", c.getCursorJsonPath());
        map.put("cursor_param", c.getCursorParam());
        map.put("page_size", c.getPageSize());
        map.put("max_articles", c.getMaxArticles());
        map.put("status", c.getStatus());
        map.put("last_sync_at", c.getLastSyncAt() != null ? c.getLastSyncAt().toString() : null);
        map.put("last_sync_count", c.getLastSyncCount());
        map.put("last_error", c.getLastError());
        map.put("created_at", c.getCreatedAt() != null ? c.getCreatedAt().toString() : null);
        map.put("updated_at", c.getUpdatedAt() != null ? c.getUpdatedAt().toString() : null);
        return map;
    }

    /** Converts a SyncJob to a response map */
    private Map<String, Object> jobToMap(SyncJob j) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", j.getId());
        map.put("connector_id", j.getConnectorId());
        map.put("status", j.getStatus());
        map.put("articles_found", j.getArticlesFound());
        map.put("articles_ingested", j.getArticlesIngested());
        map.put("articles_failed", j.getArticlesFailed());
        map.put("articles_skipped", j.getArticlesSkipped());
        map.put("started_at", j.getStartedAt() != null ? j.getStartedAt().toString() : null);
        map.put("completed_at", j.getCompletedAt() != null ? j.getCompletedAt().toString() : null);
        map.put("error_message", j.getErrorMessage());
        map.put("progress_message", j.getProgressMessage());
        return map;
    }

    /** Masks a secret value, showing only last 4 characters */
    private String maskSecret(String value) {
        if (value == null || value.length() <= 4) return "****";
        return "****" + value.substring(value.length() - 4);
    }

    /** Safely extracts a string from a map */
    private String getStr(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    /** Returns a 400 response with an error message */
    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }
}
