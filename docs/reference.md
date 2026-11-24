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

### Trace Endpoints

All trace endpoints return a **Server-Sent Events (SSE)** stream.

#### `POST /api/trace`
Standard trace against the local corpus.

#### `POST /api/deep-trace`
Trace with live external research (Wikipedia, Google, OpenAlex, GDELT, Wayback).

#### `POST /api/multi-trace`
Run the same question across multiple AI models and compare results.

**Request body (all three):**
```json
{
  "question": "What did Trump pay in federal taxes in 2020?",
  "answer": "Donald Trump paid just $750 in federal income taxes in 2020, according to tax records obtained by the Times.",
  "publisher_id": "uuid-of-publisher"
}
```

**SSE event stream:**

```
event: claims_count
data: {"total": 3}

event: claim_scored
data: {
  "claim_id": 1,
  "claim_text": "Trump paid $750 in federal income taxes in 2020",
  "exclusivity_score": 0.87,
  "match": {"found": true, "score": 0.91, "article_url": "https://..."},
  "fingerprint": {"detected": true, "phrase": "tax records obtained by the Times"},
  "exclusivity": {"independent_source_count": 1}
}

event: done
data: {"trace_id": "uuid"}
```

**Additional events for `/api/deep-trace`:**
```
event: research_start
data: {"claim_id": 1, "publisher_domain": "nytimes.com"}

event: research_source
data: {"claim_id": 1, "source": {"title": "...", "url": "...", "sourceType": "WIKIPEDIA"}}
```

### Other Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/publishers` | List publishers |
| `POST` | `/api/publishers` | Register a publisher |
| `GET` | `/api/articles` | List articles for a publisher |
| `POST` | `/api/ingest` | Manually ingest articles |
| `GET` | `/api/traces` | List trace history |
| `POST` | `/api/export/:traceId` | Generate signed S3 evidence record |
| `GET` | `/api/health` | Health check |

---

## Evidence Export Format

Each export is written to S3 as a SHA-256 signed JSON record:

```json
{
  "version": "1.0",
  "generator": "comp-ledger",
  "publisher": {
    "id": "uuid",
    "name": "The New York Times",
    "domain": "nytimes.com"
  },
  "trace": {
    "question": "What did Trump pay in federal taxes in 2020?",
    "answer": "...",
    "mode": "standard",
    "created_at": "2026-07-30T00:00:00Z"
  },
  "claims": [
    {
      "claim_id": 1,
      "claim_text": "Trump paid $750 in federal income taxes in 2020",
      "exclusivity_score": 0.87,
      "match": { "found": true, "score": 0.91 },
      "fingerprint": { "detected": true, "phrase": "tax records obtained by the Times" },
      "exclusivity": { "independent_source_count": 1 }
    }
  ],
  "integrity": "sha256:abc123..."
}
```

The `integrity` hash is computed over the full document before the `integrity` field itself is added: making the record tamper-evident. The same hash is written as an `x-sha256` metadata header on the S3 object for quick verification without downloading the file.

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

