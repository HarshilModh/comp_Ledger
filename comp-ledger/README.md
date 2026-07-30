# Comp-Ledger

**Forensic evidence for AI content attribution.** Comp-Ledger helps publishers prove that AI language models used their copyrighted content to generate responses — at inference time, without needing access to the AI company's training data.

---

## What Problem Does This Solve?

AI companies crawl and train on publisher articles without paying for them. When users ask those models questions, the answers often contain verbatim or near-verbatim content from those articles. Publishers lose both licensing revenue and web traffic, and AI companies don't disclose their training datasets — making it nearly impossible to prove which content was used.

Comp-Ledger sidesteps the training-data problem entirely: instead of asking *"did you train on my article?"*, it asks *"is this model's output statistically unique to my reporting?"* — and produces a signed, tamper-evident ledger the publisher can take to court or to a licensing negotiation.

---

## How It Works

### Core Concept: Inference-Time Fingerprinting

```
Publisher submits: question + LLM answer
                         │
                         ▼
            Decompose into atomic claims
            (Claude Haiku)
                         │
                         ▼
            Embed each claim → 512-dim vector
            (Amazon Titan Embed Text v2)
                         │
                         ▼
       ┌─────────────────┴──────────────────┐
       ▼                                    ▼
 Publisher corpus                  Global reference corpus
 (articles the publisher owns)     (publicly available articles)
       │                                    │
       └─────────────────┬──────────────────┘
                         ▼
              Score each claim:
              • Match score — does this appear in the publisher's corpus?
              • Exclusivity score — how rarely does this appear elsewhere?
              • Fingerprint score — is there a distinctive phrase?
                         │
                         ▼
            Signed evidence record (SHA-256)
            → S3 export for legal use
```

### Scoring Logic

**Exclusivity score** is the key signal:

```
baseScore = max(0.05, 1 / (1 + independentSourceCount × 0.8))
finalScore = baseScore + 0.15 (if distinctive fingerprint detected)
```

- If 0 other sources reported the detail → exclusivity near **1.0** (strong case)
- If 50 outlets reported the same thing → exclusivity near **0.05** (weak case)

A claim that scores high on **both** exclusivity and fingerprint is near-irrefutable evidence.

### Deep Research Mode

In addition to local corpus comparison, Comp-Ledger can run a live external research pass:

1. Queries **Wikipedia**, **Google Custom Search**, **OpenAlex**, and **GDELT** for each claim
2. Verifies publication timestamps via **Wayback Machine**
3. Uses Claude Sonnet as a judge to assign a verdict: `CONFIRMED`, `LIKELY`, `UNLIKELY`, or `INSUFFICIENT_DATA`
4. Boosts the exclusivity score by up to `+0.20` when the judge confirms the publisher had temporal priority

Results stream to the UI in real-time via Server-Sent Events (SSE).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Backend** | Node.js, Express 4, ESM |
| **Database** | PostgreSQL 16 + pgvector extension |
| **Embeddings** | Amazon Titan Embed Text v2 (512-dim, via AWS Bedrock) |
| **LLM scoring** | Claude Haiku (decompose), Claude Sonnet (score + judge) via AWS Bedrock |
| **External research** | Wikipedia API, Google Custom Search, OpenAlex, GDELT, Wayback Machine |
| **Export / storage** | AWS S3, SHA-256 signed JSON records |
| **Container** | Docker Compose (local dev) |

---

## Project Structure

```
comp-ledger/
├── backend/                    # Node.js / Express API
│   └── server/
│       ├── index.js            # App entry point, middleware
│       ├── routes/
│       │   ├── trace.js        # Standard trace (SSE)
│       │   ├── deep-trace.js   # Deep research trace (SSE)
│       │   ├── multi-trace.js  # Multi-model comparison
│       │   ├── publishers.js   # Publisher management
│       │   ├── articles.js     # Article management
│       │   ├── article-check.js
│       │   ├── ingest.js       # Manual ingestion
│       │   ├── export.js       # Signed S3 export
│       │   ├── traces.js       # Trace history
│       │   └── auth.js         # JWT authentication
│       ├── services/
│       │   ├── decompose.js    # Claim decomposition (Claude Haiku)
│       │   ├── embed.js        # Vector embedding (Titan)
│       │   ├── retrieve.js     # Cosine similarity retrieval
│       │   ├── score.js        # Match / exclusivity / fingerprint scoring
│       │   ├── generate.js     # Multi-model answer generation
│       │   ├── s3.js           # S3 export with SHA-256 signing
│       │   ├── rss-poller.js   # RSS feed ingestion
│       │   └── research/
│       │       ├── index.js    # Deep research orchestrator
│       │       ├── judge.js    # Claude Sonnet evidence judge
│       │       ├── wikipedia.js
│       │       ├── google-cse.js
│       │       ├── openalex.js
│       │       ├── gdelt.js
│       │       └── wayback.js
│       ├── lib/
│       │   ├── db.js           # PostgreSQL connection pool
│       │   ├── bedrock.js      # AWS Bedrock client
│       │   └── prompts.js      # LLM prompt templates
│       └── scripts/
│           ├── migrate.js      # DB schema migrations
│           ├── ingest.js       # Bulk article ingestion
│           └── build_index.js  # Vector index builder
├── frontend/                   # React SPA
│   └── src/
│       ├── components/
│       │   ├── Shell.jsx           # App layout / navigation
│       │   ├── InputPanel.jsx      # Question + answer input
│       │   ├── Ledger.jsx          # Results table with claim groups
│       │   ├── ClaimRow.jsx        # Individual claim with score detail
│       │   ├── DeepResearch.jsx    # Deep research mode UI
│       │   ├── Compare.jsx         # Multi-model comparison view
│       │   ├── PublisherDashboard.jsx
│       │   ├── PublisherOnboard.jsx
│       │   ├── ArticleCheck.jsx
│       │   ├── ArticleFactChecker.jsx
│       │   ├── Dashboard.jsx
│       │   └── ExportButton.jsx
│       └── hooks/
│           ├── useTrace.js         # Standard trace hook (SSE)
│           ├── useDeepTrace.js     # Deep trace hook (SSE)
│           ├── useMultiTrace.js    # Multi-model trace hook
│           ├── useAuth.jsx         # Auth context
│           └── useArticleCheck.js
├── docker-compose.yml          # PostgreSQL + pgvector for local dev
├── PRODUCT_VISION.md           # Full product vision and architecture
└── FREE_ALTERNATIVES.md        # Open-source alternatives to paid APIs
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- AWS account with Bedrock access (Claude Sonnet + Haiku + Titan Embed Text v2)
- (Optional) Google Custom Search API key for deep research mode

### 1. Start the Database

```bash
docker compose up -d
```

This starts PostgreSQL 16 with the pgvector extension on port 5432.

### 2. Configure Environment

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://comp:comp_dev@localhost:5432/comp_ledger

# AWS (for Bedrock embeddings + LLM scoring)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# JWT
JWT_SECRET=your_jwt_secret

# Server
PORT=4001

# Optional: deep research sources
GOOGLE_CSE_KEY=your_google_cse_key
GOOGLE_CSE_CX=your_search_engine_id

# Optional: model overrides
DECOMPOSE_MODEL_ID=anthropic.claude-haiku-4-20250514-v1:0
SCORE_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
RESEARCH_JUDGE_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
```

### 3. Run Migrations

```bash
cd backend
npm install
npm run migrate
```

### 4. Start the Backend

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:4001`.

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at `http://localhost:3000`. API calls are proxied to port 4001.

---

## Key API Endpoints

### Tracing

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/trace` | Standard trace — streams claim scores via SSE |
| `POST` | `/api/deep-trace` | Deep research trace — also queries external sources |
| `POST` | `/api/multi-trace` | Runs the same question across multiple AI models |

**Request body (all trace endpoints):**
```json
{
  "question": "What did Trump pay in federal taxes in 2020?",
  "answer": "Donald Trump paid just $750 in federal income taxes in 2020.",
  "publisher_id": "uuid-of-publisher"
}
```

**SSE event stream (trace):**
```
event: claims_count
data: {"total": 3}

event: claim_scored
data: {"claim_id": 1, "claim_text": "...", "exclusivity_score": 0.87, ...}

event: done
data: {"trace_id": "uuid"}
```

**Additional SSE events (deep-trace):**
```
event: research_start
data: {"claim_id": 1, "publisher_domain": "nytimes.com"}

event: research_source
data: {"claim_id": 1, "source": {"title": "...", "url": "...", "sourceType": "WIKIPEDIA"}}
```

### Publishers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/publishers` | List all publishers |
| `POST` | `/api/publishers` | Register a new publisher |
| `PUT` | `/api/publishers/:id` | Update publisher details |

### Articles & Ingestion

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ingest` | Manually ingest articles into a publisher corpus |
| `GET` | `/api/articles` | List articles for a publisher |
| `POST` | `/api/article-check` | Check a specific article for AI reproduction |

### Export

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/export/:traceId` | Generate a signed SHA-256 evidence record and upload to S3 |

---

## Ingesting Publisher Content

Before running traces, a publisher's articles need to be indexed:

```bash
# Bulk ingest from a JSON file
cd backend
npm run ingest -- path/to/articles.json

# Build the vector search index
npm run build-index

# Or do both in one step
npm run refresh
```

**Article JSON format:**
```json
[
  {
    "publisher_id": "uuid",
    "url": "https://nytimes.com/2020/09/27/trump-taxes.html",
    "title": "Long-Concealed Records Show Trump's Chronic Losses and Years of Tax Avoidance",
    "body_text": "...",
    "byline": "Russ Buettner, Susanne Craig, Mike McIntire",
    "published_at": "2020-09-27T00:00:00Z"
  }
]
```

You can also configure an RSS feed or REST API connector in the Publisher settings — Comp-Ledger will pull and re-index on a schedule.

---

## Evidence Export Format

Each export is a JSON file written to S3 with a SHA-256 integrity hash:

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
    "question": "...",
    "answer": "...",
    "mode": "standard",
    "created_at": "2026-07-30T00:00:00Z"
  },
  "claims": [
    {
      "claim_id": 1,
      "claim_text": "Trump paid $750 in federal income taxes in 2020",
      "exclusivity_score": 0.87,
      "match": { "score": 0.91, "article_url": "https://..." },
      "fingerprint": { "detected": true, "phrase": "..." },
      "exclusivity": { "independent_source_count": 1 }
    }
  ],
  "integrity": "sha256:abc123..."
}
```

The `integrity` hash is computed over the full document before the `integrity` field is added, making the record tamper-evident.

---

## Development Scripts

```bash
# Backend
npm run dev          # Start with auto-restart (node --watch)
npm run migrate      # Run DB schema migrations
npm run ingest       # Bulk ingest articles
npm run build-index  # Rebuild vector search index
npm run refresh      # clean + ingest + build-index

# Frontend
npm run dev          # Start Vite dev server (port 3000)
npm run build        # Production build
npm run preview      # Preview production build
```

---

## Architecture Notes

### SSE Streaming

All trace endpoints use Server-Sent Events so the UI can show results as each claim is scored, rather than waiting for the full response. The frontend hooks (`useTrace`, `useDeepTrace`) handle the SSE stream, buffer parsing, and state updates.

### Vector Search

Embeddings are stored in PostgreSQL using the **pgvector** extension. Each claim is embedded with Amazon Titan Embed Text v2 (512 dimensions) and compared against publisher and reference corpus chunks using cosine similarity.

### Data Isolation

Each publisher's corpus is strictly isolated by `publisher_id`. A publisher cannot query or compare against another publisher's articles.

### Deep Research Sources

| Source | What it provides |
|--------|-----------------|
| Wikipedia | General encyclopedic coverage |
| Google Custom Search | Web-wide coverage (requires API key) |
| OpenAlex | Academic / peer-reviewed sources |
| GDELT | News event database |
| Wayback Machine | Publication timestamp verification |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes
4. Push to your branch and open a pull request

---

## License

MIT
