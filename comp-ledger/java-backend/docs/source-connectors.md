# Source Connectors — Bulk Article Ingestion via Publisher APIs

## Overview

Source Connectors allow publishers to connect their content management systems (CMS) or 
archive APIs to CoMP Ledger. Instead of manually uploading articles one at a time, publishers 
configure a connector once and we automatically pull, chunk, embed, and index their entire 
article catalog.

**Use case:** A publisher like the NYT has 100+ million articles. They provide their API 
details (endpoint, authentication, response structure) and CoMP Ledger syncs everything 
in the background.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CoMP Ledger Backend                         │
│                                                                     │
│  ┌──────────────┐    ┌───────────────────┐    ┌─────────────────┐ │
│  │  Connector   │───▶│ ConnectorSync     │───▶│   IngestService  │ │
│  │  Controller  │    │ Service           │    │ (chunk+embed)    │ │
│  └──────────────┘    └───────────────────┘    └─────────────────┘ │
│         │                     │                        │           │
│         ▼                     ▼                        ▼           │
│  ┌──────────────┐    ┌───────────────────┐    ┌─────────────────┐ │
│  │  DynamoDB    │    │  Publisher's       │    │   DynamoDB      │ │
│  │  Connectors  │    │  External API     │    │   Chunks Table  │ │
│  │  Table       │    │  (NYT, WaPo, etc) │    │                 │ │
│  └──────────────┘    └───────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **SourceConnector** | `model/SourceConnector.java` | POJO storing connector config (URL, auth, field mappings) |
| **SyncJob** | `model/SyncJob.java` | POJO tracking a single sync execution's progress |
| **ConnectorRepository** | `repository/ConnectorRepository.java` | Interface for connector + job persistence |
| **DynamoConnectorRepository** | `repository/DynamoConnectorRepository.java` | DynamoDB implementation |
| **ConnectorSyncService** | `service/ConnectorSyncService.java` | Core sync engine — fetches, paginates, ingests |
| **ConnectorController** | `controller/ConnectorController.java` | REST API for CRUD, test, sync, and job status |

---

## Database Tables (DynamoDB)

### comp-ledger-connectors

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| publisherId | String | PK (HASH) | Publisher who owns this connector |
| connectorId | String | SK (RANGE) | Unique connector ID |
| name | String | — | Human-readable name |
| baseUrl | String | — | Publisher API base URL |
| authType | String | — | API_KEY, BEARER, BASIC, or NONE |
| authHeader | String | — | Custom header name (for API_KEY type) |
| authValue | String | — | Credential value (should be encrypted in prod) |
| listEndpoint | String | — | Path for listing articles (with placeholders) |
| detailEndpoint | String | — | Path for fetching full article body |
| articlesJsonPath | String | — | Dot-path to articles array in response |
| fieldMappings | String (JSON) | — | Maps our fields to publisher's JSON paths |
| paginationType | String | — | PAGE, OFFSET, CURSOR, or NONE |
| cursorJsonPath | String | — | Where to find next cursor in response |
| cursorParam | String | — | Query param name for cursor |
| pageSize | Number | — | Articles per page |
| maxArticles | Number | — | Max articles to sync (0 = unlimited) |
| status | String | — | ACTIVE, PAUSED, SYNCING, ERROR |
| lastSyncAt | String (ISO) | — | Last successful sync timestamp |
| lastSyncCount | Number | — | Articles ingested in last sync |
| lastError | String | — | Error from last failed sync |
| createdAt | String (ISO) | — | When created |
| updatedAt | String (ISO) | — | When last modified |

### comp-ledger-sync-jobs

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| connectorId | String | PK (HASH) | Connector this job belongs to |
| jobId | String | SK (RANGE) | Unique job ID |
| publisherId | String | — | Publisher who owns this connector |
| status | String | — | QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED |
| articlesFound | Number | — | Total articles discovered |
| articlesIngested | Number | — | Successfully indexed |
| articlesFailed | Number | — | Failed to process |
| articlesSkipped | Number | — | Already existed or too short |
| startedAt | String (ISO) | — | When job started |
| completedAt | String (ISO) | — | When job finished |
| errorMessage | String | — | Error details if failed |
| progressMessage | String | — | Human-readable progress |

---

## API Endpoints

All endpoints require authentication via `X-API-Key` header.

### Create Connector
```
POST /api/connectors
```

**Request Body:**
```json
{
  "name": "NYT Archive API",
  "base_url": "https://api.nytimes.com/svc/archive/v1",
  "auth_type": "API_KEY",
  "auth_header": "api-key",
  "auth_value": "your-nyt-api-key",
  "list_endpoint": "/{year}/{month}.json",
  "detail_endpoint": null,
  "articles_json_path": "response.docs",
  "pagination_type": "OFFSET",
  "page_size": 100,
  "max_articles": 10000,
  "field_mappings": {
    "title": "headline.main",
    "body": "lead_paragraph",
    "url": "web_url",
    "id": "_id"
  }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "NYT Archive API",
  "status": "ACTIVE",
  "created_at": "2026-07-29T18:00:00Z",
  ...
}
```

### List Connectors
```
GET /api/connectors
```

### Get Connector
```
GET /api/connectors/{connectorId}
```

### Update Connector
```
PUT /api/connectors/{connectorId}
```
Partial update — only provided fields are changed.

### Delete Connector
```
DELETE /api/connectors/{connectorId}
```
Cascading delete: removes connector + all sync history. Ingested articles remain.

### Test Connection
```
POST /api/connectors/{connectorId}/test
```
Makes a single request to verify URL, auth, and field mappings.

**Response:**
```json
{
  "success": true,
  "message": "Connection successful! Found 100 articles. Sample title: \"...\""
}
```

### Trigger Sync
```
POST /api/connectors/{connectorId}/sync
```
Starts an async background job that pulls all articles.

**Response (202):**
```json
{
  "job_id": "uuid",
  "connector_id": "...",
  "status": "RUNNING",
  "message": "Sync started. Poll GET /api/connectors/.../jobs/... for progress."
}
```

### List Sync Jobs
```
GET /api/connectors/{connectorId}/jobs?limit=10
```

### Get Job Status
```
GET /api/connectors/{connectorId}/jobs/{jobId}
```
Poll this endpoint while a sync is running.

---

## Configuration Guide

### Step 1: Identify Your API Structure

Before creating a connector, understand your API's response format:

```bash
# Example: fetch one page from your API
curl -H "api-key: YOUR_KEY" "https://api.example.com/articles?page=0&limit=10" | jq .
```

Note:
- Where is the articles array? (e.g., `response.docs`, `data.articles`, or root `[]`)
- What field holds the title? (e.g., `headline.main`, `title`)
- What field holds the full text? (e.g., `body`, `content.text`, `full_text`)
- How does pagination work? (page numbers, offsets, or cursor tokens)

### Step 2: Create the Connector

Using the API:
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_COMP_LEDGER_KEY" \
  -d '{
    "name": "My Publisher API",
    "base_url": "https://api.example.com",
    "auth_type": "API_KEY",
    "auth_header": "X-API-Key",
    "auth_value": "publisher-api-secret",
    "list_endpoint": "/articles?page={page}&limit={pageSize}",
    "articles_json_path": "data.articles",
    "pagination_type": "PAGE",
    "page_size": 50,
    "max_articles": 0,
    "field_mappings": {
      "title": "title",
      "body": "content",
      "url": "permalink",
      "id": "article_id"
    }
  }'
```

Or use the frontend UI at `/connectors` (click "New Connector").

### Step 3: Test the Connection

```bash
curl -X POST http://localhost:3001/api/connectors/{CONNECTOR_ID}/test \
  -H "X-API-Key: YOUR_COMP_LEDGER_KEY"
```

This makes a single request to verify everything is configured correctly. Fix any issues before proceeding.

### Step 4: Trigger Sync

```bash
curl -X POST http://localhost:3001/api/connectors/{CONNECTOR_ID}/sync \
  -H "X-API-Key: YOUR_COMP_LEDGER_KEY"
```

### Step 5: Monitor Progress

```bash
# Poll job status
curl http://localhost:3001/api/connectors/{CONNECTOR_ID}/jobs/{JOB_ID} \
  -H "X-API-Key: YOUR_COMP_LEDGER_KEY"
```

---

## Pagination Types

### PAGE (recommended for most APIs)
- List endpoint uses `{page}` placeholder
- Pages increment by 1 starting from 0
- Stops when a page returns fewer articles than `pageSize`
- Example: `/articles?page={page}&per_page={pageSize}`

### OFFSET
- List endpoint uses `{offset}` placeholder
- Offset increments by `pageSize` each iteration
- Example: `/articles?offset={offset}&limit={pageSize}`

### CURSOR
- Requires `cursor_json_path` and `cursor_param`
- Reads next cursor from response, passes to next request
- Stops when cursor is null/empty
- Example: Response has `{"meta": {"next_cursor": "abc123"}}`, next request: `/articles?cursor=abc123`

### NONE
- Single request, no pagination
- Use when the API returns all articles in one response (small corpora)

---

## Authentication Types

| Type | How It Works | Example |
|------|--------------|---------|
| **API_KEY** | Sends key as a custom header | `api-key: nyt_secret_123` |
| **BEARER** | Sends as Authorization Bearer token | `Authorization: Bearer token_xyz` |
| **BASIC** | Base64-encodes username:password | `Authorization: Basic dXNlcjpwYXNz` |
| **NONE** | No authentication (public APIs) | — |

---

## Field Mappings

Field mappings use **dot-notation** to navigate nested JSON:

```json
// If your API returns:
{
  "headline": { "main": "Article Title" },
  "content": { "body": "Full article text..." },
  "web_url": "https://example.com/article/123"
}

// Your field_mappings would be:
{
  "title": "headline.main",
  "body": "content.body",
  "url": "web_url"
}
```

### Required Mappings
- **title** — Path to the article's title (string)
- **body** — Path to the full article text (string)

### Optional Mappings
- **url** — Path to the article's canonical URL (stored with article metadata)
- **id** — Path to the article's unique ID (used with `detail_endpoint`)

---

## Detail Endpoint (Two-Step Fetch)

Some APIs return only summaries in the list response and require a separate call per 
article to get the full text. Configure this with:

- `detail_endpoint`: Path with `{articleId}` placeholder (e.g., `/articles/{articleId}`)
- `field_mappings.id`: Path to article ID in list response
- `field_mappings.body`: Path to full text in **detail** response

The sync service will:
1. Fetch article list (may only have titles/summaries)
2. For each article where body is empty, call `detail_endpoint`
3. Extract full text from the detail response

**Rate limiting:** 500ms delay between detail requests.

---

## Deduplication

Currently uses **title-based deduplication**: if an article with the same title already 
exists in the publisher's corpus, it's skipped during sync.

**Future improvements:**
- Hash-based dedup (SHA-256 of article body)
- Publisher article ID tracking
- Incremental sync (only fetch articles newer than last sync)

---

## Error Handling

- **Per-article failures** don't stop the sync — the article is counted as `failed` and the sync continues
- **API errors** (401, 403, 500) stop the sync and mark the job as FAILED
- **Rate limiting** (429) — currently stops the sync. Future: exponential backoff + retry
- **Network timeouts** — 60-second timeout per request; retries not yet implemented

---

## Security Considerations

### Current State (Development)
- API credentials stored as plaintext in DynamoDB
- Auth values masked in API responses (only last 4 chars shown)

### Production Recommendations
1. **Encrypt credentials at rest** — Use AWS Secrets Manager or KMS envelope encryption
2. **Rotate credentials** — Support credential refresh without re-creating the connector
3. **Audit logging** — Log all sync operations and data access
4. **Network isolation** — Run sync workers in a VPC with egress-only access to publisher APIs
5. **Input validation** — Sanitize URLs to prevent SSRF attacks (restrict to HTTPS, block private IPs)

---

## Migrating to PostgreSQL

When switching from DynamoDB to PostgreSQL (see `changes-to-do.md`):

### Connectors Table
```sql
CREATE TABLE source_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id),
    name VARCHAR(255) NOT NULL,
    base_url TEXT NOT NULL,
    auth_type VARCHAR(20) NOT NULL DEFAULT 'NONE',
    auth_header VARCHAR(100),
    auth_value TEXT,  -- Encrypt with pgcrypto!
    list_endpoint TEXT,
    detail_endpoint TEXT,
    articles_json_path TEXT,
    field_mappings JSONB NOT NULL DEFAULT '{}',
    pagination_type VARCHAR(20) DEFAULT 'NONE',
    cursor_json_path TEXT,
    cursor_param VARCHAR(100),
    page_size INTEGER DEFAULT 50,
    max_articles INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    last_sync_at TIMESTAMPTZ,
    last_sync_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connectors_publisher ON source_connectors(publisher_id);
```

### Sync Jobs Table
```sql
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES source_connectors(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    articles_found INTEGER DEFAULT 0,
    articles_ingested INTEGER DEFAULT 0,
    articles_failed INTEGER DEFAULT 0,
    articles_skipped INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    progress_message TEXT
);

CREATE INDEX idx_sync_jobs_connector ON sync_jobs(connector_id, started_at DESC);
```

### Implementation Steps
1. Create `JpaConnectorRepository` implementing `ConnectorRepository`
2. Use `@ConditionalOnProperty` to switch between DynamoDB and JPA implementations
3. Add Flyway migration scripts for the schema above
4. Test with existing connector data (export from Dynamo, import to Postgres)

---

## Example Configurations

### New York Times Archive API
```json
{
  "name": "NYT Archive",
  "base_url": "https://api.nytimes.com/svc/archive/v1",
  "auth_type": "API_KEY",
  "auth_header": "api-key",
  "auth_value": "YOUR_NYT_KEY",
  "list_endpoint": "/2024/1.json",
  "articles_json_path": "response.docs",
  "pagination_type": "NONE",
  "field_mappings": {
    "title": "headline.main",
    "body": "lead_paragraph",
    "url": "web_url",
    "id": "_id"
  }
}
```
Note: NYT Archive returns all articles for a month in one response (no pagination needed).
Set `max_articles` to limit ingestion during testing.

### Generic REST API with Cursor Pagination
```json
{
  "name": "Publisher CMS",
  "base_url": "https://cms.publisher.com/api/v2",
  "auth_type": "BEARER",
  "auth_value": "eyJ0eXAiOi...",
  "list_endpoint": "/articles?limit={pageSize}",
  "articles_json_path": "data",
  "pagination_type": "CURSOR",
  "cursor_json_path": "pagination.next_cursor",
  "cursor_param": "after",
  "page_size": 100,
  "field_mappings": {
    "title": "title",
    "body": "content.full_text",
    "url": "canonical_url",
    "id": "uuid"
  }
}
```

### RSS/Atom Feed (via RSS-to-JSON proxy)
```json
{
  "name": "Publisher RSS Feed",
  "base_url": "https://rss2json.com/api.json",
  "auth_type": "API_KEY",
  "auth_header": "api_key",
  "auth_value": "YOUR_RSS2JSON_KEY",
  "list_endpoint": "?rss_url=https://publisher.com/rss&count={pageSize}",
  "articles_json_path": "items",
  "pagination_type": "NONE",
  "field_mappings": {
    "title": "title",
    "body": "content",
    "url": "link"
  }
}
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Could not find articles array" | Wrong `articles_json_path` | Check API response structure with curl |
| "title field mapping didn't match" | Wrong path in field_mappings | Use dot-notation matching your JSON |
| "HTTP 401" | Invalid or expired credentials | Update `auth_value` in connector config |
| "HTTP 429" | Rate limited | Increase delay or reduce `page_size` |
| All articles skipped | Already ingested | Expected on re-sync; dedup by title |
| Sync stuck on SYNCING | Worker crashed | Restart backend; status will self-correct |

---

## Future Enhancements

1. **Scheduled syncs** — Cron-based automatic re-sync (daily/weekly)
2. **Incremental sync** — Only fetch articles published since last sync
3. **Webhook triggers** — Publisher pushes new article events to us
4. **S3 drop support** — Watch an S3 bucket for new article files
5. **Custom transformers** — Clean HTML, strip ads, normalize encoding
6. **Retry with backoff** — Handle 429/5xx with exponential backoff
7. **Credential encryption** — AWS Secrets Manager integration
8. **Sync scheduling UI** — Configure sync frequency from the frontend
