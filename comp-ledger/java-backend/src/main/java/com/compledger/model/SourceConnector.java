package com.compledger.model;

import java.time.Instant;
import java.util.Map;

/**
 * Represents a publisher's external content API configuration.
 *
 * A SourceConnector stores everything needed to pull articles from a publisher's
 * API: the endpoint URL, authentication details, pagination strategy, and field
 * mappings that tell our system where to find the article title, body, and URL
 * in the API response.
 *
 * Example: NYT might configure:
 *   - baseUrl: "https://api.nytimes.com/svc/archive/v1"
 *   - authType: "API_KEY"
 *   - authHeader: "api-key"
 *   - authValue: "nyt-secret-key-here"
 *   - listEndpoint: "/{year}/{month}.json"
 *   - articlesJsonPath: "response.docs"
 *   - fieldMappings: { "title": "headline.main", "body": "lead_paragraph", "url": "web_url" }
 *   - paginationType: "OFFSET"
 *   - pageSize: 100
 */
public class SourceConnector {

    /** Unique identifier for this connector configuration */
    private String id;

    /** The publisher who owns this connector */
    private String publisherId;

    /** Human-readable name (e.g., "NYT Archive API") */
    private String name;

    /** Base URL of the publisher's API (e.g., "https://api.nytimes.com/svc") */
    private String baseUrl;

    /**
     * Authentication type: API_KEY, BEARER, BASIC, or NONE.
     * Determines how credentials are sent with each request.
     */
    private String authType;

    /**
     * The header name used for authentication.
     * For API_KEY: could be "api-key", "X-API-Key", etc.
     * For BEARER: typically "Authorization" (value gets "Bearer " prefix automatically).
     * For BASIC: "Authorization" (value is base64-encoded automatically).
     */
    private String authHeader;

    /**
     * The credential value. Stored encrypted in production (see docs).
     * For API_KEY: the raw key value.
     * For BEARER: the token (we add "Bearer " prefix).
     * For BASIC: "username:password" (we base64-encode it).
     */
    private String authValue;

    /**
     * The endpoint path for listing/searching articles.
     * Supports placeholders: {page}, {offset}, {cursor}, {year}, {month}.
     * Example: "/v2/articles?page={page}&limit={pageSize}"
     */
    private String listEndpoint;

    /**
     * Optional endpoint for fetching a single article's full text.
     * If null, we assume the list endpoint returns full article bodies.
     * Supports placeholder: {articleId}
     * Example: "/v2/articles/{articleId}"
     */
    private String detailEndpoint;

    /**
     * JSON path (dot-notation) to the array of articles in the list response.
     * Example: "response.docs" means response JSON looks like {"response": {"docs": [...]}}
     * Use "" or null if the response root IS the array.
     */
    private String articlesJsonPath;

    /**
     * Maps our internal field names to the publisher's API field paths.
     * Required keys: "title", "body"
     * Optional keys: "url", "id", "publishedDate"
     *
     * Values are dot-notation paths into each article object.
     * Example: {"title": "headline.main", "body": "full_text", "url": "web_url"}
     */
    private Map<String, String> fieldMappings;

    /**
     * Pagination strategy: OFFSET, PAGE, CURSOR, or NONE.
     * - OFFSET: uses offset query param, increments by pageSize
     * - PAGE: uses page number, increments by 1
     * - CURSOR: uses a cursor/token from the previous response
     * - NONE: single request, no pagination
     */
    private String paginationType;

    /**
     * For CURSOR pagination: the JSON path in the response where the next cursor lives.
     * Example: "meta.next_cursor"
     */
    private String cursorJsonPath;

    /**
     * For CURSOR pagination: the query parameter name to pass the cursor.
     * Example: "cursor" or "after"
     */
    private String cursorParam;

    /** Number of articles to fetch per page/request. Default: 50 */
    private int pageSize;

    /** Maximum total articles to fetch in one sync run. 0 = unlimited. */
    private int maxArticles;

    /**
     * Connector status: ACTIVE, PAUSED, ERROR, SYNCING.
     * Only ACTIVE connectors are picked up by the scheduled sync job.
     */
    private String status;

    /** Timestamp of the last successful sync completion */
    private Instant lastSyncAt;

    /** Number of articles successfully ingested in the last sync */
    private int lastSyncCount;

    /** Error message from the last failed sync attempt, if any */
    private String lastError;

    /** When this connector configuration was created */
    private Instant createdAt;

    /** When this connector configuration was last modified */
    private Instant updatedAt;

    // --- Getters and Setters ---

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPublisherId() { return publisherId; }
    public void setPublisherId(String publisherId) { this.publisherId = publisherId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getAuthType() { return authType; }
    public void setAuthType(String authType) { this.authType = authType; }

    public String getAuthHeader() { return authHeader; }
    public void setAuthHeader(String authHeader) { this.authHeader = authHeader; }

    public String getAuthValue() { return authValue; }
    public void setAuthValue(String authValue) { this.authValue = authValue; }

    public String getListEndpoint() { return listEndpoint; }
    public void setListEndpoint(String listEndpoint) { this.listEndpoint = listEndpoint; }

    public String getDetailEndpoint() { return detailEndpoint; }
    public void setDetailEndpoint(String detailEndpoint) { this.detailEndpoint = detailEndpoint; }

    public String getArticlesJsonPath() { return articlesJsonPath; }
    public void setArticlesJsonPath(String articlesJsonPath) { this.articlesJsonPath = articlesJsonPath; }

    public Map<String, String> getFieldMappings() { return fieldMappings; }
    public void setFieldMappings(Map<String, String> fieldMappings) { this.fieldMappings = fieldMappings; }

    public String getPaginationType() { return paginationType; }
    public void setPaginationType(String paginationType) { this.paginationType = paginationType; }

    public String getCursorJsonPath() { return cursorJsonPath; }
    public void setCursorJsonPath(String cursorJsonPath) { this.cursorJsonPath = cursorJsonPath; }

    public String getCursorParam() { return cursorParam; }
    public void setCursorParam(String cursorParam) { this.cursorParam = cursorParam; }

    public int getPageSize() { return pageSize; }
    public void setPageSize(int pageSize) { this.pageSize = pageSize; }

    public int getMaxArticles() { return maxArticles; }
    public void setMaxArticles(int maxArticles) { this.maxArticles = maxArticles; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(Instant lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public int getLastSyncCount() { return lastSyncCount; }
    public void setLastSyncCount(int lastSyncCount) { this.lastSyncCount = lastSyncCount; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
