# Comp-Ledger: Product Vision & Architecture

## What Is This?

Comp-Ledger is a forensic evidence tool for publishers to prove that AI language models used their copyrighted content to generate responses — without needing access to the AI company's training data.

Instead of trying to prove "you trained on my article" (which requires access to a training dataset that AI companies refuse to disclose), Comp-Ledger proves it at inference time: "this model's output contains phrasing and factual combinations that are statistically unique to my reporting."

The platform produces a signed, tamper-evident ledger that a publisher can take off-platform and use in legal proceedings, licensing negotiations, or compensation claims.

---

## The Problem

1. AI companies crawl and train on publisher articles without paying for them
2. When users query those models, answers often contain verbatim or near-verbatim content from those articles
3. Users get the answer directly from the AI — the publisher loses both licensing revenue and web traffic
4. AI companies don't disclose their training datasets, making it nearly impossible to prove which content was used
5. Publishers have no defensible, quantified evidence of how much their work contributes to AI outputs

**Real-world context:** The NYT vs. OpenAI lawsuit, EU AI Act debates, and recent licensing deals (OpenAI + AP, OpenAI + Axel Springer) show publishers are actively looking for leverage. A tool that quantifies how much of their work was used gives them negotiating power in court and at the negotiating table.

---

## The Solution: Inference-Time Fingerprinting

Rather than inspecting training data, Comp-Ledger inspects the model's *output* and traces each factual claim back to its likely source using two corpora:

| Corpus | Contents | Purpose |
|--------|----------|---------|
| **Publisher corpus** | All articles from that publisher | What the publisher owns |
| **Global reference corpus** | All publicly available articles at scale | What "common knowledge" looks like |

The **uniqueness score** is the key insight: if a claim in the LLM's answer matches the publisher's article but does *not* appear in the global reference corpus, that's strong evidence the model drew specifically from the publisher's content — not from general public knowledge.

---

## User Flow

### 1. Publisher Onboarding

- Publisher creates an account on Comp-Ledger
- Publisher connects their article archive via API (their CMS — WordPress, Arc, Contentful, etc. — exposes a REST API; publisher provides an API key or OAuth token)
- Credentials are stored securely (e.g. AWS Secrets Manager — never in a plain database column)
- Initial bulk ingest pulls all historical articles
- Ongoing sync via webhooks: CMS notifies Comp-Ledger on each new publish, keeping the corpus current

### 2. Ingestion & Categorization

On ingest, each article is:
1. **Categorized** using an LLM into a shared taxonomy (e.g. Politics > SCOTUS, Science > Climate, Business > Tech)
   - Auto-classification means publishers don't manually tag millions of articles
   - Multi-label support for articles that span categories (e.g. economics of climate policy → Business + Science)
2. **Chunked** into paragraph-level segments
3. **Embedded** into 512-dimensional vectors (Amazon Titan Embed Text v2)
4. **Indexed** into the publisher's isolated corpus

The global reference corpus uses the same taxonomy and embedding model so comparisons are like-for-like.

**Data isolation:** Each publisher's corpus is strictly isolated. Publisher A cannot query Publisher B's articles.

### 3. Query: Tracing an LLM Response

The publisher provides:
- A **question** they asked an LLM (e.g. ChatGPT, Claude, Gemini)
- The **LLM's response**

The system then:

1. **Decomposes** the response into atomic factual claims using Claude Haiku
   - Example response: *"In 2020, Trump paid just $750 in federal income taxes, according to tax records obtained by the Times."*
   - Becomes claims: `["Trump paid $750 in federal income taxes in 2020", "The tax records were obtained by the New York Times"]`

2. **Embeds** each claim into a vector

3. **Retrieves** the most semantically similar chunks from both corpora (scoped to the matching category for efficiency)

4. **Scores** each claim via Claude Sonnet across three dimensions:
   - **Match score** — does this claim appear in the publisher's corpus?
   - **Exclusivity score** — how rarely does it appear in the global reference corpus?
     - Formula: `baseScore = max(0.05, 1 / (1 + independentSourceCount × 0.8))`
     - Fingerprint bonus: `+0.15` if a distinctive phrase is detected
     - If 0 other sources reported this detail → exclusivity near 1.0 (strong case)
     - If 50 outlets reported the same detail → exclusivity near 0.05 (weak case)
   - **Fingerprint score** — is there a distinctive phrase that couldn't be coincidental even if the fact was widely reported?

5. **Aggregates** into a per-claim scorecard and an overall uniqueness score for the full response

### 4. The Ledger Export

The publisher downloads a **signed evidence record** containing:
- Every claim with its match, exclusivity, and fingerprint scores
- The source passages from the publisher corpus that matched
- A SHA-256 integrity hash (computed before the `integrity` field is added, then embedded — making it tamper-evident)
- An `x-sha256` metadata header written to S3 for quick verification without downloading the file
- Version, timestamp, generator, and publisher metadata

**This is where Comp-Ledger's responsibility ends.** What the publisher does with the ledger — demand letter, lawsuit, licensing negotiation — is entirely off-platform.

---

## Two Axes of Proof

The scoring system gives publishers two independent dimensions of evidence:

| Dimension | What it proves | Strong when |
|-----------|---------------|-------------|
| **Uniqueness / Exclusivity** | The model got this from the publisher, not common knowledge | Score near 1.0; few or zero other sources reported this detail |
| **Fingerprinting** | The phrasing is so distinctive it couldn't be coincidental | Detected = true; the phrase exists in the publisher's article and nowhere else |

A claim that scores high on both is near-irrefutable. A claim that scores low on both is probably just common knowledge and makes a weak case.

---

## Why the Reference Corpus Scale Matters

The ~30 reference articles in the current proof-of-concept are a placeholder. For the exclusivity score to be **legally meaningful**:

- A defense lawyer can dismiss "not found in 30 articles" trivially
- The reference corpus needs to represent *"everything an AI could plausibly have learned this from that isn't the publisher"*
- In practice this means indexing at Common Crawl scale — hundreds of millions of web pages and news articles
- Only then does "not found in references" become a genuinely strong signal

This is the hardest infrastructure problem in the product, but it's an infrastructure and data problem — the concept is proven at small scale and extrapolates directly.

---

## Architecture Overview

```
Publisher CMS (API / Webhook)
        │
        ▼
  Ingestion Service
  ├── LLM categorization
  ├── Chunking
  ├── Titan Embed (512-dim vectors)
  └── Write to Publisher Corpus (isolated per account)

Global Reference Corpus (pre-built, petabyte-scale)
  ├── Same taxonomy
  ├── Same embedding model
  └── Read-only at query time

Query Flow (publisher submits Q + LLM answer)
        │
        ▼
  Decompose (Claude Haiku) → atomic claims
        │
        ▼
  Embed each claim (Titan)
        │
        ▼
  Retrieve top-N from Publisher Corpus + Reference Corpus
  (scoped to matching category)
        │
        ▼
  Score each claim (Claude Sonnet)
  ├── Match score
  ├── Exclusivity score
  └── Fingerprint score
        │
        ▼
  Scorecard (per claim + overall)
        │
        ▼
  Export → SHA-256 signed ledger (JSON) → S3
        │
        ▼
  Publisher downloads ledger → off-platform legal action
```

---

## What Is Already Built (Current Codebase)

The core scoring pipeline is fully implemented and proven:

| Component | Status | Location |
|-----------|--------|----------|
| Atomic claim decomposition | Done | `DecomposeService` |
| Vector embedding (Titan v2) | Done | `EmbedService` |
| In-memory cosine retrieval | Done | `RetrieveService` / `IndexService` |
| Match + exclusivity + fingerprint scoring | Done | `ScoreService` |
| Multi-model answer generation | Done | `GenerateService` (5 models) |
| SHA-256 signed S3 export | Done | `S3Service` / `ExportController` |
| SSE streaming scorecard UI | Done | React client |
| Java backend (Spring Boot 3.3 / Java 21) | Done | `java-backend/` |
| Node.js backend (Fastify) | Done | `backend/` |

**What needs to be built for production:**
- Publisher account management and authentication
- CMS API ingestion pipeline with webhook support
- Secure credential storage (AWS Secrets Manager)
- Per-publisher corpus isolation
- Global reference corpus at scale (petabyte-level indexing)
- LLM-based article categorization on ingest
- Category-scoped retrieval at query time
- Billing and usage metering

---

---

## Upcoming Features (Detailed Implementation Plans)

### 1. Trace History & Analytics Dashboard

**Problem:** Every trace a publisher runs is ephemeral — results vanish after the browser session ends. The Dashboard page is currently blank. Publishers need a historical record to track infringement patterns over time, build cumulative legal evidence, and justify licensing fee demands with data.

**What It Does:**

Each time a publisher runs a trace (single or multi-model), the full result is persisted:
- The original question + answer submitted
- Every extracted claim with its exclusivity score, match info, and fingerprint detection
- Which model(s) generated the answer
- The overall infringement severity (how many claims scored above threshold)
- Timestamp and publisher ID

The Dashboard then provides:
- **Trace timeline** — chronological list of all past traces with severity indicators
- **Aggregated stats** — total claims analyzed, % with high exclusivity, most-infringed articles
- **Trend graphs** — infringement over time (e.g., "Model X used more of our content this month")
- **Top offenders** — which models produce the most publisher-exclusive content in their answers
- **Article heatmap** — which publisher articles are referenced most often by AI models
- **Export all** — bulk export all trace history as evidence bundles for legal discovery

**API Design:**
```
POST /api/traces                    → auto-saved after each trace completes
GET  /api/traces                    → list all (paginated, filterable by date/model/severity)
GET  /api/traces/{traceId}          → full trace detail with all scored claims
GET  /api/traces/stats              → aggregated analytics (counts, averages, trends)
DELETE /api/traces/{traceId}        → remove a trace from history
```

**Database Schema (DynamoDB):**
- Table: `comp-ledger-traces`
- PK: `publisherId`, SK: `traceId` (UUID, sortable by timestamp prefix)
- Attributes: question, answer, model, mode, claims (JSON), overallScore, createdAt

**Why It Matters for Sales:**
- Turns a one-off tool into a monitoring platform (recurring value)
- "X% of Model Y's answers about topic Z relied on your reporting" is a powerful negotiation fact
- Cumulative evidence is stronger in court than a single snapshot

---

### 2. Scheduled Connector Syncs

**Problem:** Connectors currently only sync when manually triggered. For a publisher with an active newsroom publishing 50–200 articles daily, manual syncs mean the corpus is always stale. New articles won't appear in trace results until someone remembers to click "Sync."

**What It Does:**

Each connector gets an optional sync schedule (cron expression or preset interval):
- **Hourly** — for breaking-news publishers where freshness matters
- **Daily** (default) — for most publishers; runs at a configurable time (e.g., 3 AM UTC)
- **Weekly** — for archives or slower-publishing outlets
- **Custom cron** — for advanced users (e.g., "every 6 hours on weekdays")

The scheduler:
1. Runs a background job (Spring `@Scheduled` or Quartz) that checks all ACTIVE connectors
2. For each connector whose next sync time has passed, queues a SyncJob
3. Jobs run sequentially per publisher (to avoid overloading their API) but in parallel across publishers
4. On failure, the scheduler retries with exponential backoff (1h → 4h → 24h) then pauses the connector
5. Publishers receive a notification (email or in-app) when a sync completes or fails

**API Additions:**
```
PUT /api/connectors/{id}  (add fields: sync_schedule, sync_timezone, next_sync_at)
GET /api/connectors/{id}/schedule  → shows next scheduled run
POST /api/connectors/{id}/pause    → pauses scheduled sync (manual still works)
POST /api/connectors/{id}/resume   → resumes scheduled sync
```

**Connector Model Additions:**
- `syncSchedule` — cron expression or preset (HOURLY, DAILY, WEEKLY)
- `syncTimezone` — publisher's preferred timezone for daily runs
- `nextSyncAt` — computed next run time (used by scheduler to pick up work)
- `retryCount` — how many times the last sync has been retried
- `maxRetries` — configurable (default 3)

**Implementation Notes:**
- Use Spring's `@Scheduled(fixedDelay = 60000)` to poll every minute for due connectors
- Each sync job is already async (`@Async`), so we just need the scheduling trigger
- Store `nextSyncAt` on the connector; after each sync, compute the next one from the cron
- Dead-letter handling: after `maxRetries`, set connector to PAUSED and alert the publisher

**Why It Matters:**
- Zero-maintenance for the publisher after initial setup
- Corpus is always up-to-date with latest published articles
- Critical for "monitoring" use case (trace against today's AI outputs, catch yesterday's published content being used)

---

### 3. Incremental Sync

**Problem:** The current sync pulls ALL articles every time and deduplicates by title match. For NYT (100M+ articles), a full sync takes days and wastes API calls, embeddings budget, and DynamoDB writes on articles we already have.

**What It Does:**

Instead of fetching everything, incremental sync only fetches articles published or updated since the last successful sync:

1. **Date-based filtering** — pass a `since` parameter to the publisher's API (e.g., `?published_after=2026-07-28`)
2. **Cursor checkpoint** — for cursor-paginated APIs, save the last cursor and resume from there
3. **Dedup by publisher ID** — track each article's external ID to detect updates vs. new articles
4. **Update handling** — if an already-ingested article has been updated (corrected, expanded), re-chunk and re-embed only the changed article

**Connector Model Additions:**
- `lastSyncCursor` — checkpoint cursor for APIs that support resuming
- `lastSyncTimestamp` — ISO timestamp of the newest article fetched in the last sync
- `sinceParam` — query parameter name for date filtering (e.g., `published_after`, `since`, `from_date`)
- `sinceFormat` — date format the API expects (ISO 8601, Unix epoch, custom)
- `syncMode` — FULL or INCREMENTAL (publisher can force a full re-sync if needed)

**Sync Logic:**
```
if connector.syncMode == INCREMENTAL and connector.lastSyncTimestamp != null:
    url += "&{sinceParam}={lastSyncTimestamp}"  // only fetch newer articles

for each article:
    existing = findByExternalId(publisherId, article.externalId)
    if existing == null:
        ingest(article)  // new article
    elif article.updatedAt > existing.ingestedAt:
        deleteChunks(existing)
        ingest(article)  // re-index updated article
    else:
        skip  // already up-to-date
```

**Article Model Addition:**
- `externalId` — the article's ID in the publisher's system (for dedup)
- `externalUpdatedAt` — when the publisher last modified it (for change detection)

**Performance Impact:**
- Full sync of 1M articles: ~3 days (API calls + embedding at 10 articles/sec)
- Incremental sync of 200 new daily articles: ~2 minutes
- 1500× faster for ongoing operations

**Why It Matters:**
- Makes scheduled syncs practical (daily sync of 200 new articles, not 1M re-checks)
- Dramatically reduces AWS costs (fewer Titan Embed calls, fewer DynamoDB writes)
- Handles corrections/updates (publisher fixes a typo → we re-index that article)
- Required for any publisher with a corpus larger than ~10,000 articles

---

### 4. Usage Metering & Billing

**Problem:** CoMP Ledger has no way to track how much each publisher is using the platform. Without metering, we can't price the product, enforce tier limits, or show publishers their usage.

**What It Does:**

Tracks every billable action per publisher per billing period (month):

| Metric | What It Counts | Why It's Billable |
|--------|---------------|-------------------|
| **Traces run** | Each trace request (single or multi-model) | Each trace = 1 decompose + N embeds + N scores (Bedrock costs) |
| **Claims scored** | Total claims processed across all traces | More claims = more Bedrock Sonnet calls |
| **Articles ingested** | New articles chunked and embedded | Each article = N Titan Embed calls |
| **Chunks stored** | Total vector chunks in DynamoDB | Storage + retrieval costs |
| **Exports generated** | Signed evidence records written to S3 | S3 storage + legal-grade tamper-proofing |
| **Connector syncs** | Background sync job executions | API call volume + compute time |

**Tier Structure (proposed):**

| Tier | Traces/mo | Articles | Chunks Storage | Price |
|------|-----------|----------|----------------|-------|
| **Starter** | 100 | 1,000 | 50,000 | $99/mo |
| **Professional** | 1,000 | 50,000 | 500,000 | $499/mo |
| **Enterprise** | Unlimited | Unlimited | Unlimited | Custom |

**API Design:**
```
GET /api/usage                      → current period usage summary
GET /api/usage/history?months=6     → historical usage by month
GET /api/usage/breakdown            → per-metric breakdown with daily granularity
```

**Data Model:**
```
Table: comp-ledger-usage
PK: publisherId
SK: periodKey (e.g., "2026-07" for monthly, "2026-07-29" for daily)
Attributes: tracesRun, claimsScored, articlesIngested, chunksStored, exportsGenerated, syncJobsRun
```

**Implementation:**
1. **Event-driven metering** — each service increments counters after completing work:
   - `TraceController` → increment tracesRun + claimsScored
   - `IngestService` → increment articlesIngested + chunksStored
   - `ExportController` → increment exportsGenerated
   - `ConnectorSyncService` → increment syncJobsRun + articlesIngested
2. **Atomic counters** — use DynamoDB `UpdateItem` with `ADD` (no read-before-write race)
3. **Tier enforcement** — check limits before processing; return 429 with upgrade message if exceeded
4. **Usage dashboard** — frontend widget showing current usage vs. limit (progress bars)
5. **Overage alerts** — email publisher at 80% and 100% of tier limits

**Billing Integration (future):**
- Stripe subscription management
- Automatic tier upgrades when usage consistently exceeds limits
- Pay-per-use overage pricing for Enterprise tier
- Invoice generation with detailed per-metric breakdown

**Why It Matters for the Business:**
- Revenue model: usage-based pricing aligns our costs (Bedrock calls) with revenue
- Self-service: publishers can see exactly what they're paying for
- Retention signal: decreasing usage = churn risk, increasing = expansion opportunity
- Enterprise sales: "you ran 15,000 traces last quarter" justifies the contract value

---

## Positioning

Comp-Ledger is a **forensic evidence tool**, not a legal platform. The boundary is the signed export. This keeps scope tight and liability low — the platform doesn't give legal advice, file claims, or manage negotiations. It produces the evidence; publishers decide what to do with it.

This positions the product well as the **infrastructure layer** for the emerging publisher-vs-AI legal landscape — a space where multiple well-funded parties (publishers, AI companies, governments) all need a credible, neutral source of truth about content attribution.
