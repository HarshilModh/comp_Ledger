import { Router } from 'express';
import { z } from 'zod';
import { decompose } from '../services/decompose.js';
import { embedText } from '../services/embed.js';
import { retrieveCandidates } from '../services/retrieve.js';
import { scoreClaim, computeExclusivityScore } from '../services/score.js';
import { deepResearch } from '../services/research/index.js';
import { query } from '../lib/db.js';

const router = Router();

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function localPipeline(claimText, publisherId) {
  const vector = await embedText(claimText);
  const { publisherHits, referenceHits } = await retrieveCandidates(vector, 5, publisherId);
  const scoreResult = await scoreClaim(claimText, publisherHits, referenceHits);
  const exclusivityScore = computeExclusivityScore(
    scoreResult.exclusivity?.independent_source_count || 0,
    scoreResult.fingerprint?.detected || false
  );
  return { ...scoreResult, exclusivity_score: exclusivityScore };
}

function mergeResults(claim, localResult, researchResult) {
  const boost = researchResult.judge?.verdict === 'CONFIRMED' ? 0.2
    : researchResult.judge?.verdict === 'LIKELY' ? 0.1 : 0;
  const finalScore = Math.min(1.0, Math.round(((localResult.exclusivity_score || 0) + boost) * 100) / 100);
  return {
    claim_id: claim.id, claim_text: claim.text, mode: 'deep-research',
    ...localResult, exclusivity_score: finalScore,
    research: {
      verdict: researchResult.judge?.verdict || 'INSUFFICIENT_DATA',
      confidence: researchResult.judge?.confidence || 0,
      reasoning: researchResult.judge?.reasoning || '',
      temporal_priority: researchResult.judge?.temporal_priority || false,
      earliest_publisher_date: researchResult.judge?.earliest_publisher_date || null,
      publisher_url: researchResult.judge?.publisher_url || null,
      source_count: researchResult.source_count,
      publisher_source_count: researchResult.publisher_source_count,
      sources: researchResult.sources,
    },
  };
}

router.post('/api/deep-trace', async (req, res) => {
  const parsed = z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    publisher_id: z.string().uuid(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { question, answer, publisher_id } = parsed.data;
  const pubResult = await query('SELECT * FROM publishers WHERE id = $1 AND status = $2', [publisher_id, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const publisher = pubResult.rows[0];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const claims = await decompose(question, answer);
    sse(res, 'claims_count', { total: claims.length });

    const scoredClaims = [];
    for (const claim of claims) {
      sse(res, 'research_start', { claim_id: claim.id, claim_text: claim.text, publisher_domain: publisher.domain });
      try {
        const [localResult, researchResult] = await Promise.all([
          localPipeline(claim.text, publisher_id),
          deepResearch(claim.text, publisher, {
            onSource: (source) => sse(res, 'research_source', { claim_id: claim.id, source }),
          }),
        ]);
        const merged = mergeResults(claim, localResult, researchResult);
        scoredClaims.push(merged);
        sse(res, 'claim_scored', merged);
      } catch (err) {
        const event = { claim_id: claim.id, claim_text: claim.text, mode: 'deep-research', scoring_failed: true, error: err.message, exclusivity_score: 0 };
        scoredClaims.push(event);
        sse(res, 'claim_scored', event);
      }
    }

    let traceId = null;
    try {
      const r = await query('INSERT INTO traces (question, answer, mode, claims, model_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [question, answer, 'deep-research', JSON.stringify(scoredClaims), publisher_id]);
      traceId = r.rows[0]?.id;
    } catch (_) {}

    sse(res, 'done', { trace_id: traceId });
    res.end();
  } catch (err) {
    sse(res, 'error', { error: err.message });
    res.end();
  }
});

export default router;
