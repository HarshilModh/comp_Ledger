# CoMP Ledger: Vision Document

## Vision

**One sentence:** CoMP Ledger scores how exclusive a publisher's claims are against the rest of the public record, which tells an editor before publication which parts of a story are genuinely theirs, and tells a licensing manager after publication which claims an AI assistant reproduced that existed nowhere else.

## Problem

AI assistants and AI search summaries answer reader questions using publisher content, then send almost no traffic back. Some publishers report referral declines above 50%. IAB Tech Lab released the Content Monetization Protocol (CoMP) v1.0 to fix this, setting a standard way for AI systems and content owners to agree commercial terms before content is crawled or used.

CoMP defines the contract. It does not tell a publisher whether the contract is being honored, and it does not give a publisher without a deal any leverage to get one. Large publishers negotiate on scale and legal weight. Mid and long-tail publishers, which is most of the market, have nothing to put on the table, because they cannot point at anything specific and say "that is ours."

The honest version of the problem: they do not need courtroom proof. They need enough evidence to make a deal cheaper than a fight.

## Solution

A publisher's archive is indexed, alongside a reference corpus representing the rest of the public record on the same topics. An operator enters a reader question and the AI-generated answer to it.

Amazon Bedrock breaks the answer into discrete factual claims. Each claim is scored on three axes rather than one similarity number:

* **Match:** does this claim appear in the publisher's archive, and in which paragraph?
* **Exclusivity:** how many independent sources in the reference corpus also carry this claim? A claim carried by forty outlets is worth nothing. A claim carried only by this publisher is the whole point.
* **Fingerprint:** does the answer reproduce something idiosyncratic to this publisher's version? A distinctive phrasing, an unusual framing, an ordering of points, or an error only this outlet made.

The user sees a ledger with one row per claim, sorted by exclusivity rather than similarity. High-exclusivity claims are the evidence. The user then exports a signed JSON usage record with a SHA-256 hash to S3, structured to line up with CoMP usage reporting.

**What this tool does not claim.** It does not prove the AI trained on or retrieved from this publisher. Facts are not copyrightable and a semantic match is correlation, not causation. It narrows the plausible source set and flags the cases where that set is small. This is stated in the UI, not buried.

### Two modes, one engine

The same exclusivity engine runs in both directions depending on what you feed it.

* **Audit mode (input: an AI answer).** Which claims in this AI answer trace to our archive and exist nowhere else? Output is the evidence ledger described above. This is the licensing product, used occasionally and worth a lot when it fires.
* **Differentiate mode (input: our own draft or a published article).** Which claims in this piece are genuinely ours, which are commodity that dozens of outlets already carry, and who covered each one first? Output is a pre-publish score: percentage original, the list of exclusive claims worth leading with, and the competitor who broke each commodity claim.

Differentiate mode is the daily-use product. An editor gets told "sixty percent of this piece is commodity, here are your three original claims, lead with those." Run across the whole archive, it becomes a portfolio view showing which beats produce original reporting and which produce restated wire copy, which is a budget conversation for an executive.

The two modes compound. The score that tells an editor a claim is original before publication is the same score that proves it was theirs when an AI reproduces it afterward. One engine, two products, and the pre-publish one is what a publisher would pay for every month.

## Technical Architecture

### AWS Services

* **Amazon Bedrock (Claude):** Three jobs. Claim decomposition, splitting the AI answer into discrete factual claims. Exclusivity judgment, deciding how many genuinely independent sources carry a claim, which is a reasoning task that vector similarity alone gets wrong. Fingerprint detection, flagging reproduced phrasing or errors idiosyncratic to one source. Each returns a short written rationale, which is what makes the evidence record readable by a human negotiator instead of a black box score.
* **Amazon Bedrock (Titan Embeddings):** Vectorizes both corpora and each extracted claim so retrieval narrows to a handful of candidates before the reasoning step. This is what keeps a run under ten seconds.
* **Amazon S3:** Stores the publisher archive, the reference corpus, the prebuilt embedding index, the CoMP agreement registry, and the generated signed evidence records.
* **AWS Lambda:** Orchestrates the pipeline. See the deployment note in the stack section below, this is the one piece we will cut if time runs short.

Deliberately not using Comprehend, Textract, Polly, or Translate. Bedrock already handles the extraction, and adding services we do not need weakens the architecture rather than strengthening it.

### Data Flow

1. **Setup (pre-built before the demo):** Publisher archive and reference corpus are embedded and the index is written to S3, along with a registry of which AI systems hold an active CoMP agreement.
2. **User:** Enters a reader question and the AI-generated answer to it.
3. **System:** Sends the answer to Bedrock Claude for claim decomposition.
4. **System:** Embeds each claim with Titan and retrieves candidates from the publisher archive and, separately, from the reference corpus.
5. **System:** For each claim, Bedrock Claude returns a match against the publisher passage, an independent-source count, a fingerprint flag, and a rationale for each.
6. **System:** Assembles the ledger sorted by exclusivity, checks the agreement registry, and marks exclusive claims as unlicensed evidence where no agreement exists.
7. **System:** On export, writes a signed JSON usage record with a SHA-256 hash to S3 and returns the reference to the UI.

## Technology Stack

### Backend

* **Node.js with Fastify.** Chosen over Java and Spring Boot deliberately. This is a one-day build where Claude Code writes most of the code, so iteration speed matters more than language familiarity. Fastify reloads in under a second, the AWS SDK v3 for JS is fully supported for Bedrock, and the whole service fits in three or four files. Unifies the stack to a single language across frontend and backend.
* **AWS SDK v3** for all AWS calls: `@aws-sdk/client-bedrock-runtime` for both Claude and Titan, `@aws-sdk/client-s3` for storage.
* **Zod** for request and response models, which also gives us schema validation on the JSON coming back from Bedrock. This matters, because the single most common failure mode in this build is the model returning malformed JSON.
* **Plain JS array operations** for cosine similarity. With a corpus this small (under 150 documents, a few thousand chunks) an in-memory dot product is faster than any vector database and has zero setup cost — five lines of code. Do not reach for OpenSearch Serverless, pgvector, or Pinecone. Provisioning time alone would cost more than the retrieval saves.
* **Fastify** as the server, with its built-in SSE support for streaming.

### Frontend

* **React 18 with Vite.** Fast dev server, no build config to fight.
* **Tailwind CSS** for styling. The ledger is a table with expandable rows and colored score badges, which is exactly what utility classes are good at.
* **Server-Sent Events** for streaming claims into the ledger one at a time as they resolve. This is worth the small amount of extra work: watching rows appear and sort themselves live is a large part of the demo's impact, and it also hides the total latency.
* No component library, no state management library, no router. One page.

### Data preparation

* **csv-parse** to slice the source dataset into the publisher archive and the reference corpus.
* A one-time **`build_index.js`** script that chunks both corpora, calls Titan Embeddings in batches, and writes the vectors plus metadata to S3 as a single file. Run this once in the morning. The app loads it at startup and never re-embeds.

### Deployment

* **Run locally for the demo.** Fastify on localhost calling Bedrock over the network is still real AWS usage, and it removes cold starts, deployment failures, and venue wifi from the critical path.
* **Lambda only if there is time left after the demo works.** Package with a container image if attempted. This is the first thing to cut.
* Keep AWS credentials in a `.env` file loaded with dotenv. Never in the repo.

### Tooling

* **Claude Code** for the build, driven from this document.
* **git** with frequent commits. Tag the moment the demo first works end to end, so there is always something to fall back to.
* **`demo-script.md`** written before the last hour, plus screenshots of a successful run as the backup if the live demo misbehaves.

## Users & Roles

* **Editor (differentiate mode):** Runs a draft before publication, sees the originality score and the list of exclusive claims, and reshapes the piece to lead with what is actually theirs. This is the daily user.
* **Publisher Rights or Licensing Manager (audit mode):** Runs reader questions against their own archive, reviews the evidence ledger, and exports records to open or strengthen a licensing negotiation.
* **AI Platform Compliance Lead:** Uses the same ledger in reverse, to check whether content their system surfaced traces to a publisher they have no agreement with.

## Key Workflows

1. User opens the app and selects a publisher archive that is already indexed.
2. User types a reader question about a story this publisher broke or covered in unusual depth, and pastes in the AI assistant's answer.
3. User clicks **"Trace & Score"**.
4. The ledger populates claim by claim as results stream in. Each row shows the claim, its exclusivity score, how many other sources carry it, and whether a fingerprint was detected. Rows sort live so the most exclusive claims rise to the top.
5. User clicks the top row to expand it. The panel shows the publisher's original sentence, the AI answer's version, the reason the claim was judged exclusive, and the fingerprint if there is one.
6. User toggles the CoMP agreement registry to active for that AI system and re-runs, showing the same evidence resolving as covered rather than unlicensed.
7. User clicks **"Export Evidence Record"** and receives the signed S3 JSON with its hash.

## Minimum Demo, what success looks like

1. Enter one reader question plus one AI answer, click Trace & Score, and get a populated ledger of at least five claims in under 10 seconds.
2. The ledger visibly separates commodity claims (carried by many sources, scored low) from exclusive claims (carried only by this publisher, scored high). The separation is the product.
3. At least one claim scores as exclusive, with a written rationale and a citation to the specific publisher paragraph.
4. Expand that claim to show the publisher's original sentence next to the AI answer's version, with a detected fingerprint highlighted.
5. Toggle the CoMP agreement to active, re-run, and show the evidence resolving as covered. Export the signed record and show the SHA-256 hash and JSON in S3.

**Stretch, only if 1 through 5 are solid:** flip to differentiate mode, paste in a draft article, and show the originality percentage with the exclusive claims called out. Same pipeline, different input. If this is not rock solid it stays out of the four minutes and gets described in one sentence instead.

## Out of Scope Today

* Live crawling or scraping of any real AI product. The answer is entered by the user, which keeps the demo legal, fast, and offline-safe.
* A real CoMP protocol implementation or handshake. We generate CoMP-shaped usage records, we do not implement the spec.
* A web-scale reference corpus. Today's corpus is a seeded topic-specific set standing in for the public record. Production would need a real index, and we will say so.
* Any claim of proven derivation, training-data membership, or attribution certainty. The output is narrowed plausibility with stated reasoning, not proof.
* Payment rails, invoicing, and live dollar amounts in the product. The pricing model is a stated position in the business section, not a fabricated rate card in the UI. The evidence is the value, not the arithmetic.
* Portfolio and beat-level analysis across the whole archive. Differentiate mode runs on one document today.
* Image, video, and audio. Text only.
* Authentication, multi-tenancy, and persistence beyond S3.

## Business Model

### How content should be priced under CoMP

Per token is what AI systems prefer, because it treats every thousand words as identical and prices an exclusive investigation the same as a recipe roundup. Per article is what publishers can currently measure, but it undercharges badly, since a piece crawled once and used in ten thousand answers still pays once.

Our position is **exclusivity-weighted per use**: price on how often content actually appears in answers, multiplied by how substitutable it is. Commodity claims settle near zero. Exclusive claims carry real value. This is the model most parties would prefer and nobody uses, because until now neither variable was measurable. Both are exactly what this tool outputs. The pricing model does not exist because the measurement does not exist, and the measurement is what we built.

### How CoMP Ledger itself makes money

The closest working analogy is a performing rights organization. ASCAP and BMI exist because an individual songwriter cannot track or bill every radio play, so a collective does the measurement and takes a cut.

* **Subscription** per publisher for differentiate mode, the pre-publish tool. Predictable revenue, daily usage, priced per seat or per volume of drafts.
* **Percentage of recovered licensing revenue** on audit mode. Aligns our incentives with the publisher's and means a small publisher pays nothing until it works.
* **Aggregation, longer term.** A hundred mid-sized publishers pooling evidence have leverage none of them has alone. This is where the real business is, and it is only possible once the measurement layer exists.

## Judging Alignment

* **Business impact:** CoMP defines the contract but nothing today proves usage against it. Publishers outside the top tier are not negotiating badly, they are not negotiating at all, because they have nothing to show. This turns "we think they use our content" into a short list of claims that exist in their archive and nowhere else. The same engine run forward instead of backward becomes a pre-publish editorial tool, which is the recurring revenue, with licensing recovery as the upside. Two products, one measurement layer, and a pricing model (exclusivity-weighted per use) that the industry cannot adopt until someone builds exactly this.
* **Innovation angle:** Existing tools do plagiarism detection or bot blocking. Both are defensive and both operate on the crawl, before value is extracted. This works on the output: it starts from the answer a reader actually saw and reasons backward. The technical twist is scoring exclusivity rather than similarity, which is the difference between a metric that means something and one that lights up for every outlet that covered the same story.
* **Demo hook:** Two rows side by side. One claim the AI got from forty places, scored near zero. One claim that existed only in this publisher's archive, reproduced in the AI answer with the publisher's own distinctive phrasing intact. The judges are publishing executives looking at their own content, and at the exact moment it stopped being theirs.

## Build Order

Do these in sequence. Do not start step 3 until step 2 produces a real spread of scores.

1. Pick the topic and split the dataset into publisher archive and reference corpus.
2. Run `build_index.py`, then test three or four questions by hand and confirm exclusivity scores actually vary. If everything comes back commodity, change the topic, not the code.
3. Backend pipeline: decompose, retrieve, score, return JSON.
4. Frontend ledger, static first, streaming second.
5. Evidence record export to S3.
6. Agreement toggle and re-run.
7. `demo-script.md` and backup screenshots.
8. Differentiate mode. Reuses the whole pipeline, only the input handler and the summary panel are new.
9. Lambda deployment, only if everything above is done.

## Open Questions for the Team

* Exclusivity threshold. Suggest starting at three or fewer independent sources counting as exclusive, then tuning against the demo corpus.
* Reference corpus size. Big enough that commodity claims genuinely score low, small enough to index quickly. Start around 60 to 100 documents.
* Whether to seed one deliberate fingerprint in the demo corpus to guarantee the key moment lands, and if so, how to disclose that clearly in the demo rather than get caught on it.
