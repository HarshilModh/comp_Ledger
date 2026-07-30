# CoMP Ledger — AI Content Attribution Platform

> **Forensic evidence for publishers.** Prove that AI language models used your copyrighted content — at inference time, without needing access to training data.

---

## The Problem

AI companies train on publisher articles without licensing them. When users ask those models questions, the answers often contain verbatim or near-verbatim content from those articles. Publishers lose both licensing revenue and web traffic — and because AI companies don't disclose their training datasets, it has been nearly impossible to prove which content was used.

**CoMP Ledger solves this at inference time.** Instead of asking *"did you train on my article?"*, it asks *"is this model's output statistically unique to my reporting?"* — and produces a signed, tamper-evident ledger that can be used in court or in licensing negotiations.

Real-world context: the NYT vs. OpenAI lawsuit, EU AI Act debates, and recent licensing deals (OpenAI + AP, OpenAI + Axel Springer) show publishers are actively looking for leverage. CoMP Ledger gives them a quantified, defensible evidence base.

---

## How It Works

### 1. Inference-Time Fingerprinting

```
Publisher submits:  question  +  LLM answer
                              │
                    ┌─────────▼──────────┐
                    │  Decompose claims   │  ← Claude Haiku
                    │  (atomic facts)     │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Embed each claim   │  ← Amazon Titan Embed v2
                    │  (512-dim vector)   │
                    └─────────┬──────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
     Publisher corpus                Reference corpus
     (articles you own)              (public web — "common knowledge")
               └──────────────┬──────────────┘
                              ▼
                    ┌─────────────────────┐
                    │   Score each claim   │  ← Claude Sonnet
                    │  • Match score       │
                    │  • Exclusivity score │
                    │  • Fingerprint score │
                    └─────────┬───────────┘
                              ▼
                   SHA-256 signed evidence record
                   → S3 export for legal use
```

### 2. The Scoring System

**Exclusivity** is the key signal — if a claim matches the publisher's article but does *not* appear in the global reference corpus, that's strong evidence the model drew from the publisher's content, not from common knowledge.

```
baseScore        = max(0.05, 1 / (1 + independentSourceCount × 0.8))
fingerprintBonus = +0.15  (if a distinctive phrase is detected)
exclusivityScore = min(1.0, baseScore + fingerprintBonus)
```

| Score range | Meaning |
|-------------|---------|
| **0.7 – 1.0** | High confidence — few or no other sources; strong attribution signal |
| **0.4 – 0.7** | Limited sourcing — some corroboration exists |
| **0.0 – 0.4** | Widely known — common knowledge, weak attribution case |

### 3. Deep Research Mode

Beyond local corpus comparison, Deep Research mode runs a live external evidence sweep for each claim:

| Source | What it provides |
|--------|-----------------|
| **Wikipedia** | General encyclopedic coverage |
| **Google Custom Search** | Broad web coverage |
| **OpenAlex** | Peer-reviewed academic sources |
| **GDELT** | Global news event database |
| **Wayback Machine** | Publication timestamp verification |

A Claude Sonnet judge then weighs all sources and assigns a verdict — `CONFIRMED`, `LIKELY`, `UNLIKELY`, or `INSUFFICIENT_DATA` — and boosts the exclusivity score by up to `+0.20` when the publisher had temporal priority.

Results stream to the UI in real time via Server-Sent Events.

---

## Features

- **Standard Trace** — decompose any LLM answer into claims and score each one against the publisher corpus
- **Deep Research Trace** — augment local scoring with live external source retrieval and AI judging
- **Multi-Model Compare** — run the same question across multiple AI models and compare results side by side
- **Article Fact Checker** — check a specific article for AI reproduction patterns
- **Publisher Dashboard** — manage publishers, corpora, RSS feeds, and API connectors
- **Signed Evidence Export** — download a SHA-256 tamper-evident JSON record for legal proceedings
- **Trace History** — all past traces are persisted and searchable
- **Real-time streaming UI** — claims appear as they are scored, no waiting for the full response

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS |
| Backend | Node.js 20, Express 4, ESM |
| Database | PostgreSQL 16 + pgvector |
| Embeddings | Amazon Titan Embed Text v2 (512-dim, AWS Bedrock) |
| LLM — decompose | Claude Haiku (AWS Bedrock) |
| LLM — scoring + judge | Claude Sonnet (AWS Bedrock) |
| External research | Wikipedia, Google CSE, OpenAlex, GDELT, Wayback Machine |
| Export / storage | AWS S3, SHA-256 signed JSON |
| Containerisation | Docker Compose |

---

## Project Structure

```
comp-ledger/
├── backend/                        # Express API (Node.js ESM)
│   └── server/
│       ├── index.js                # App entry, middleware, rate limiting
│       ├── routes/
│       │   ├── trace.js            # Standard trace — SSE stream
│       │   ├── deep-trace.js       # Deep research trace — SSE stream
│       │   ├── multi-trace.js      # Multi-model comparison
│       │   ├── publishers.js       # Publisher CRUD
│       │   ├── articles.js         # Article management
│       │   ├── article-check.js    # Per-article AI reproduction check
│       │   ├── ingest.js           # Manual corpus ingestion
│       │   ├── export.js           # Signed S3 export
│       │   ├── traces.js           # Trace history
│       │   └── auth.js             # JWT authentication
│       ├── services/
│       │   ├── decompose.js        # Claim decomposition — Claude Haiku
│       │   ├── embed.js            # Vector embedding — Amazon Titan
│       │   ├── retrieve.js         # Cosine similarity retrieval
│       │   ├── score.js            # Match / exclusivity / fingerprint scoring
│       │   ├── generate.js         # Multi-model answer generation
│       │   ├── s3.js               # S3 export with SHA-256 integrity
│       │   ├── rss-poller.js       # RSS feed auto-ingestion
│       │   └── research/
│       │       ├── index.js        # Deep research orchestrator
│       │       ├── judge.js        # Claude Sonnet evidence judge
│       │       ├── wikipedia.js
│       │       ├── google-cse.js
│       │       ├── openalex.js
│       │       ├── gdelt.js
│       │       └── wayback.js
│       ├── lib/
│       │   ├── db.js               # PostgreSQL connection pool
│       │   ├── bedrock.js          # AWS Bedrock client
│       │   └── prompts.js          # LLM prompt templates
│       └── scripts/
│           ├── migrate.js          # DB schema migrations
│           ├── ingest.js           # Bulk article ingestion
│           └── build_index.js      # Vector index builder
├── frontend/                       # React SPA
│   └── src/
│       ├── components/
│       │   ├── Shell.jsx           # App layout and sidebar navigation
│       │   ├── InputPanel.jsx      # Question + answer input
│       │   ├── Ledger.jsx          # Claim results table with score groups
│       │   ├── ClaimRow.jsx        # Individual claim detail row
│       │   ├── DeepResearch.jsx    # Deep research mode UI
│       │   ├── Compare.jsx         # Multi-model comparison view
│       │   ├── PublisherDashboard.jsx
│       │   ├── PublisherOnboard.jsx
│       │   ├── ArticleCheck.jsx
│       │   ├── Dashboard.jsx
│       │   └── ExportButton.jsx
│       └── hooks/
│           ├── useTrace.js         # Standard trace SSE hook
│           ├── useDeepTrace.js     # Deep research SSE hook
│           ├── useMultiTrace.js    # Multi-model trace hook
│           └── useAuth.jsx         # Auth context
├── docker-compose.yml              # PostgreSQL + pgvector for local dev
└── PRODUCT_VISION.md               # Full product vision and architecture
```

---

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

# AWS — required for embeddings and LLM scoring
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
DECOMPOSE_MODEL_ID=anthropic.claude-haiku-4-20250514-v1:0
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

You can also connect an RSS feed or a REST API in the Publisher settings — CoMP Ledger will pull and re-index automatically.

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

The `integrity` hash is computed over the full document before the `integrity` field itself is added — making the record tamper-evident. The same hash is written as an `x-sha256` metadata header on the S3 object for quick verification without downloading the file.

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

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes with clear messages
4. Push and open a pull request

---

## License

MIT
