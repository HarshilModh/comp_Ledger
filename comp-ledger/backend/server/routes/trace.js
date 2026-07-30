import { readFileSync, existsSync } from 'fs';
import { Router } from 'express';
import { decompose } from '../services/decompose.js';
import { embedText } from '../services/embed.js';
import { retrieveCandidates } from '../services/retrieve.js';
import { scoreClaim, computeExclusivityScore } from '../services/score.js';
import { generateAnswer, AVAILABLE_MODELS } from '../services/generate.js';
import { query } from '../lib/db.js';

const router = Router();

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/api/trace', async (req, res) => {
  const { question, answer: manualAnswer, mode = 'audit', auto = false, modelId } = req.body;

  if (req.query.mock === 'true') {
    const fallbackPath = './data/demo-fallback.json';
    if (existsSync(fallbackPath)) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const fallback = JSON.parse(readFileSync(fallbackPath, 'utf-8'));
      for (const event of fallback.events) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        await new Promise(r => setTimeout(r, 600));
      }
      res.write(`event: done\ndata: {}\n\n`);
      return res.end();
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let answer = manualAnswer;

    if (auto) {
      sse(res, 'generating', { modelId });
      const chosenModel = modelId || AVAILABLE_MODELS[0].id;
      answer = await generateAnswer(question, chosenModel);
      sse(res, 'answer', { answer, modelId: chosenModel });
    }

    if (!answer?.trim()) {
      sse(res, 'error', { error: 'No answer to trace' });
      return res.end();
    }

    const claims = await decompose(question, answer);
    sse(res, 'claims_count', { total: claims.length });

    const scoredClaims = [];
    for (const claim of claims) {
      try {
        const vector = await embedText(claim.text);
        const { publisherHits, referenceHits } = await retrieveCandidates(vector);
        const scoreResult = await scoreClaim(claim.text, publisherHits, referenceHits);
        const exclusivityScore = computeExclusivityScore(
          scoreResult.exclusivity?.independent_source_count || 0,
          scoreResult.fingerprint?.detected || false
        );
        const event = { claim_id: claim.id, claim_text: claim.text, mode, ...scoreResult, exclusivity_score: exclusivityScore };
        scoredClaims.push(event);
        sse(res, 'claim_scored', event);
      } catch (err) {
        const event = { claim_id: claim.id, claim_text: claim.text, mode, scoring_failed: true, error: err.message, exclusivity_score: 0 };
        scoredClaims.push(event);
        sse(res, 'claim_scored', event);
      }
    }

    sse(res, 'done', {});
    res.end();

    try {
      await query('INSERT INTO traces (question, answer, mode, claims) VALUES ($1, $2, $3, $4)', [question, answer, mode, JSON.stringify(scoredClaims)]);
    } catch (_) {}

  } catch (err) {
    sse(res, 'error', { error: err.message });
    res.end();
  }
});

export default router;
