import { Router } from 'express';
import { z } from 'zod';
import { decompose } from '../services/decompose.js';
import { embedText } from '../services/embed.js';
import { retrieveCandidates } from '../services/retrieve.js';
import { scoreClaim, computeExclusivityScore } from '../services/score.js';
import { query } from '../lib/db.js';

const router = Router();

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/api/article-check', async (req, res) => {
  const parsed = z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    publisher_id: z.string().uuid(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { question, answer, publisher_id } = parsed.data;
  const pubResult = await query('SELECT id FROM publishers WHERE id = $1 AND status = $2', [publisher_id, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const claims = await decompose(question, answer);
    sse(res, 'claims_count', { total: claims.length });

    const scoredClaims = [];
    for (const claim of claims) {
      try {
        const vector = await embedText(claim.text);
        const { publisherHits, referenceHits } = await retrieveCandidates(vector, 5, publisher_id);
        const scoreResult = await scoreClaim(claim.text, publisherHits, referenceHits);
        const exclusivityScore = computeExclusivityScore(
          scoreResult.exclusivity?.independent_source_count || 0,
          scoreResult.fingerprint?.detected || false
        );
        const event = { claim_id: claim.id, claim_text: claim.text, mode: 'article-check', ...scoreResult, exclusivity_score: exclusivityScore };
        scoredClaims.push(event);
        sse(res, 'claim_scored', event);
      } catch (err) {
        const event = { claim_id: claim.id, claim_text: claim.text, mode: 'article-check', scoring_failed: true, error: err.message, exclusivity_score: 0 };
        scoredClaims.push(event);
        sse(res, 'claim_scored', event);
      }
    }

    sse(res, 'done', {});
    res.end();

    try {
      await query('INSERT INTO traces (question, answer, mode, claims, model_id) VALUES ($1, $2, $3, $4, $5)',
        [question, answer, 'article-check', JSON.stringify(scoredClaims), publisher_id]);
    } catch (_) {}
  } catch (err) {
    sse(res, 'error', { error: err.message });
    res.end();
  }
});

export default router;
