# CoMP Ledger setup and reference

Back to the [README](../README.md).

## Getting Started

### Prerequisites

- **Node.js 20+**
- **Docker & Docker Compose**
- **AWS account** with Bedrock enabled (models: Claude Haiku, Claude Sonnet, Titan Embed Text v2)
- *(Optional)* Google Custom Search API key for deep research mode

### 1. Start the Database

```bash
cd comp-ledger
docker compose up -d
```

This starts PostgreSQL 16 with the pgvector extension on `localhost:5432`.

### 2. Configure the Backend

Create `comp-ledger/backend/.env`:

```env
# Database
DATABASE_URL=postgresql://comp:comp_dev@localhost:5432/comp_ledger

# AWS: required for embeddings and LLM scoring
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# JWT auth
JWT_SECRET=change_me_in_production

# Server port
PORT=4001

# Optional: Google Custom Search (deep research mode)
GOOGLE_CSE_KEY=your_google_api_key
GOOGLE_CSE_CX=your_search_engine_id

# Optional: model overrides (defaults shown)
DECOMPOSE_MODEL_ID=anthropic.claude-haiku-4-5-20251001-v1:0
SCORE_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
RESEARCH_JUDGE_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
```

### 3. Run Migrations & Start the Backend

```bash
cd comp-ledger/backend
npm install
npm run migrate   # creates tables and pgvector index
npm run dev       # starts on port 4001 with auto-restart
```

### 4. Start the Frontend

```bash
cd comp-ledger/frontend
npm install
npm run dev       # starts on port 3000, proxies /api to 4001
```

Open `http://localhost:3000`.

---

## Ingesting Publisher Content

Before running traces, index a publisher's articles:

```bash
cd comp-ledger/backend

# Bulk ingest from a JSON file
npm run ingest -- path/to/articles.json

# Build the vector search index
npm run build-index

# Or clean + ingest + index in one step
npm run refresh
```

**Article JSON format:**

```json
[
  {
    "publisher_id": "your-publisher-uuid",
    "url": "https://nytimes.com/2020/09/27/trump-taxes.html",
    "title": "Long-Concealed Records Show Trump's Chronic Losses",
    "body_text": "Full article text...",
    "byline": "Russ Buettner, Susanne Craig",
    "published_at": "2020-09-27T00:00:00Z"
  }
]
```

You can also connect an RSS feed or a REST API in the Publisher settings: CoMP Ledger will pull and re-index automatically.

---

## API Reference

### Trace endpoints

All four trace endpoints return a **Server-Sent Events (SSE)** stream.

| Endpoint | Request body | What it does |
|---|---|---|
| `POST /api/trace` | `question`, optional `answer`, `mode`, `auto`, `modelId` | Traces an answer against the whole publisher corpus. With `auto` and no `answer`, it first generates the answer with the chosen Bedrock model. |
| `POST /api/article-check` | `question`, `answer`, `publisher_id` | Traces an answer against one publisher's archive only. |
| `POST /api/deep-trace` | `question`, `answer`, `publisher_id` | Trace plus live research (Wikipedia, Google Custom Search, OpenAlex, Wayback Machine) and a verdict per claim. |
| `POST /api/multi-trace` | `question`, optional `modelIds` | Generates an answer from each chosen model (all available models if none given) and traces each one. |

`GET /api/models` lists the models available to `/api/trace` and `/api/multi-trace`.

**Example request (`/api/deep-trace`):**

```json
{
  "question": "What did Trump pay in federal taxes in 2020?",
  "answer": "Donald Trump paid just $750 in federal income taxes in 2020, according to tax records obtained by the Times.",
  "publisher_id": "uuid-of-publisher"
}
```

**SSE events:**

| Event | Sent by | Payload |
|---|---|---|
| `generating`, `answer` | trace (auto mode) | The model being called, then its answer |
| `claims_count` | trace, article check, deep research | Number of claims found |
| `claim_scored` | all | One scored claim (see below) |
| `research_start`, `research_source` | deep research | Research starting for a claim, then each source found |
| `models`, `model_start`, `model_answer`, `model_done`, `model_error` | multi-trace | Progress for each model |
| `error` | all | An error message |
| `done` | all | End of the stream |

**A `claim_scored` payload:**

```json
{
  "claim_id": 1,
  "claim_text": "Trump paid $750 in federal income taxes in 2020",
  "match": { "found": true },
  "exclusivity": { "independent_source_count": 1, "sources": [], "reasoning": "..." },
  "fingerprint": { "detected": true },
  "exclusivity_score": 0.71
}
```

Deep research claims also carry the research sources, Wayback results and a judge verdict of `CONFIRMED`, `LIKELY`, `UNCONFIRMED` or `INSUFFICIENT_DATA`. `CONFIRMED` adds 0.20 to the score and `LIKELY` adds 0.10, capped at 1.0.

### Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/google` | Sign up, sign in (password or Google), sign out |
| `GET` | `/api/auth/me` | Current user |
| `PUT` | `/api/auth/change-password` | Change password |
| `GET` / `POST` | `/api/publishers` | List or register publishers |
| `GET` / `PUT` / `DELETE` | `/api/publishers/:id` | Read, update or remove a publisher |
| `GET` | `/api/publishers/:id/stats`, `/api/publishers/:id/activity` | Publisher dashboard data |
| `GET` / `POST` | `/api/publishers/:id/articles` | List or add articles |
| `POST` | `/api/publishers/:id/articles/bulk`, `/articles/url`, `/articles/bulk-url` | Bulk JSON or URL import |
| `DELETE` | `/api/publishers/:id/articles/:articleId` | Remove an article |
| `POST` | `/api/publishers/:id/rss/poll` | Poll the publisher's RSS feed now |
| `POST` | `/api/publishers/:id/crawl` | Discover articles from the site's sitemaps and feeds |
| `PUT` / `DELETE` | `/api/publishers/:id/pull-config` | Set or clear a pull source |
| `PUT` | `/api/publishers/:id/pull-schedule` | `hourly`, `daily`, `weekly` or `null` |
| `POST` | `/api/publishers/:id/pull`, `/api/publishers/:id/pull-test` | Run or test a pull |
| `POST` / `DELETE` | `/api/publishers/:id/api-key` | Create or revoke the publisher's push API key |
| `POST` | `/api/ingest`, `/api/ingest/batch` | Push articles with the publisher API key (`Authorization: Bearer` or `x-api-key`) |
| `POST` | `/api/webhook/:publisherId` | Webhook ingestion (`x-webhook-secret` or `x-api-key`) |
| `GET` | `/api/traces`, `/api/traces/:id` | Trace history |
| `POST` | `/api/export` | Build an evidence record and write it to S3 |
| `GET` | `/api/health` | Health check |

---

## Evidence Export Format

`POST /api/export` takes `claims`, `question`, `answer` and an optional `publisher_name`, and writes a JSON record like this to S3:

```json
{
  "version": "1.0",
  "type": "comp_evidence_record",
  "generated_at": "2026-07-30T00:00:00.000Z",
  "generator": "comp-ledger/0.1.0",
  "publisher": { "name": "Silicon Insider", "archive_id": "silicon-insider-2024-q1" },
  "query": { "question": "...", "answer": "..." },
  "claims": [
    {
      "id": 1,
      "text": "...",
      "exclusivity_score": 0.71,
      "independent_source_count": 1,
      "match": { "found": true },
      "fingerprint": { "detected": true },
      "agreement_status": "unlicensed"
    }
  ],
  "summary": {
    "total_claims": 3,
    "exclusive_claims": 1,
    "fingerprinted_claims": 1,
    "average_exclusivity": 0.42
  },
  "integrity": { "sha256": "abc123..." }
}
```

The SHA-256 hash is computed over the record before the `integrity` field is added, which makes the record tamper-evident: anyone can remove `integrity`, recompute the hash and compare. The same hash is stored as `x-sha256` metadata on the S3 object, and its first 8 characters are part of the file name. If the S3 write fails, the API still returns the record and its hash.

---

## Development Scripts

```bash
# Backend
npm run dev          # Start with auto-restart (node --watch)
npm run start        # Production start
npm run migrate      # Run DB schema migrations
npm run ingest       # Bulk ingest articles
npm run build-index  # Rebuild vector search index
npm run refresh      # clean + ingest + build-index in one step

# Frontend
npm run dev          # Vite dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build locally
```

