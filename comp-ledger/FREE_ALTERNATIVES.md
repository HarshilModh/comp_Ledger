# Migrating CoMP Ledger Off AWS

Currently the platform uses AWS Bedrock for all AI calls and Amazon S3 for file storage.
This document maps every AWS dependency to a free or low-cost alternative.

---

## 1. AI Models (AWS Bedrock → Free APIs)

### Embeddings (replaces Amazon Titan Embed v2)
Used in: `server/services/article-ingest.js`, `server/routes/trace.js`

| Option | Free tier | Notes |
|--------|-----------|-------|
| **Ollama (local)** `nomic-embed-text` | Unlimited, runs locally | Best for local dev. 768-dim vectors. |
| **Hugging Face Inference API** `sentence-transformers/all-MiniLM-L6-v2` | 30k req/month free | 384-dim vectors, very fast. |
| **Cohere Embed v3** | 1000 req/month free | Good quality, 1024-dim. |
| **Google Gemini Embedding** | 1500 req/day free | `text-embedding-004`, 768-dim. |

**Recommended:** Ollama locally, Hugging Face for hosted.

Change in `article-ingest.js`:
```js
// Replace embedWithBedrock(text) with:
const res = await fetch('http://localhost:11434/api/embeddings', {
  method: 'POST',
  body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
});
const { embedding } = await res.json();
```

---

### LLM Calls (replaces Claude Haiku/Sonnet via Bedrock)
Used in: `server/lib/prompts.js`, `server/services/retrieve.js`, `server/routes/trace.js`

| Option | Free tier | Notes |
|--------|-----------|-------|
| **Google Gemini Flash 2.0** | 1500 req/day, 1M tokens/min | Fast, very capable. Best free option. |
| **Groq** (Llama 3.1 8B / 70B) | 14,400 req/day free | Fastest inference available. |
| **Ollama (local)** `llama3.1:8b` | Unlimited | No internet needed. |
| **OpenRouter** | Free tier with many models | Aggregates dozens of models. |
| **Anthropic API** (direct, not Bedrock) | $5 free credit on sign-up | Same models without AWS. |

**Recommended:** Groq for speed (free), Gemini Flash for quality (free).

Groq drop-in (OpenAI-compatible SDK):
```js
import Groq from 'groq-sdk'; // npm install groq-sdk
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const resp = await groq.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: prompt }],
});
const text = resp.choices[0].message.content;
```

Gemini drop-in:
```js
import { GoogleGenerativeAI } from '@google/generative-ai'; // npm install @google/generative-ai
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });
const result = await model.generateContent(prompt);
const text = result.response.text();
```

---

## 2. Object Storage (replaces Amazon S3)
Used in: bulk JSON upload endpoint

| Option | Free tier | Notes |
|--------|-----------|-------|
| **Cloudflare R2** | 10 GB/month, no egress fees | S3-compatible API, just swap endpoint |
| **Backblaze B2** | 10 GB free | S3-compatible |
| **Supabase Storage** | 1 GB free | Good if you move to Supabase Postgres too |
| **Local disk** | Unlimited | Fine for single-server self-hosting |

**Easiest:** Switch to local disk storage (saves files in `/tmp/uploads`) for self-hosting, or Cloudflare R2 for production (uses same AWS SDK, just different endpoint + keys).

---

## 3. Database (keep PostgreSQL + pgvector)

No change needed. PostgreSQL + pgvector can run:
- **Locally** via Docker: `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 pgvector/pgvector:pg16`
- **Neon.tech** — free tier with 0.5 GB, supports pgvector
- **Supabase** — free tier with 500 MB, supports pgvector
- **Render** — free PostgreSQL (limited, sleeps after inactivity)

---

## 4. Required `.env` Changes

```env
# Remove these:
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=

# Add these instead:
GROQ_API_KEY=               # from console.groq.com (free)
GEMINI_API_KEY=             # from aistudio.google.com (free)
OLLAMA_BASE_URL=http://localhost:11434   # if using local Ollama

# Or for Anthropic direct (same models, no AWS):
ANTHROPIC_API_KEY=          # from console.anthropic.com
```

---

## 5. Minimal Migration Plan

### Step 1 — Embeddings
Replace `embedWithBedrock()` in `server/services/article-ingest.js` and `server/routes/trace.js` with Ollama `nomic-embed-text` or HuggingFace.

> Note: Existing embeddings in the DB will be incompatible (different model = different vector space). You'll need to re-ingest all articles after switching.

### Step 2 — Claim decomposition (Haiku calls)
In `server/lib/prompts.js` / `server/services/retrieve.js`, replace `invokeBedrock()` with Groq or Gemini.

### Step 3 — Answer generation
In `server/routes/trace.js` `generateAnswer()`, swap Bedrock model calls for Groq/Gemini equivalents.

### Step 4 — Compare models
Update `AVAILABLE_MODELS` in the generate service to list Groq/Gemini models instead of Bedrock ARNs.

### Step 5 — S3
If not using file upload, this can be skipped. Otherwise switch to local disk.

---

## 6. Fully Local Stack (zero cost, offline)

Install [Ollama](https://ollama.com), then:
```bash
ollama pull llama3.1:8b       # LLM
ollama pull nomic-embed-text  # embeddings
```

Then point all AI calls to `http://localhost:11434`. The entire platform runs with no external API calls.
