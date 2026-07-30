import { Router } from 'express';
import { generateAnswer, AVAILABLE_MODELS } from '../services/generate.js';
import { decompose } from '../services/decompose.js';
import { embedText } from '../services/embed.js';
import { retrieveCandidates } from '../services/retrieve.js';
import { scoreClaim, computeExclusivityScore } from '../services/score.js';
import { query } from '../lib/db.js';

const router = Router();

async function traceAnswer(question, answer) {
  const claims = await decompose(question, answer);
  return Promise.all(claims.map(async (claim) => {
    try {
      const vector = await embedText(claim.text);
      const { publisherHits, referenceHits } = await retrieveCandidates(vector);
      const scoreResult = await scoreClaim(claim.text, publisherHits, referenceHits);
      const exclusivityScore = computeExclusivityScore(
        scoreResult.exclusivity?.independent_source_count || 0,
        scoreResult.fingerprint?.detected || false,
      );
      return { claim_id: claim.id, claim_text: claim.text, ...scoreResult, exclusivity_score: exclusivityScore };
    } catch {
      return { claim_id: claim.id, claim_text: claim.text, scoring_failed: true, exclusivity_score: 0 };
    }
  }));
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/api/multi-trace', async (req, res) => {
  const { question, modelIds } = req.body;
  const models = modelIds?.length ? AVAILABLE_MODELS.filter(m => modelIds.includes(m.id)) : AVAILABLE_MODELS;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sse(res, 'models', { models: models.map(m => ({ id: m.id, label: m.label })) });

  await Promise.all(models.map(async (model) => {
    try {
      sse(res, 'model_start', { modelId: model.id });
      const answer = await generateAnswer(question, model.id);
      sse(res, 'model_answer', { modelId: model.id, answer });
      const claims = await traceAnswer(question, answer);
      sse(res, 'model_done', { modelId: model.id, claims });
      try {
        await query('INSERT INTO traces (question, answer, mode, claims, model_id) VALUES ($1, $2, $3, $4, $5)',
          [question, answer, 'multi', JSON.stringify(claims), model.id]);
      } catch (_) {}
    } catch (err) {
      sse(res, 'model_error', { modelId: model.id, error: err.message });
    }
  }));

  sse(res, 'done', {});
  res.end();
});

router.get('/api/models', (req, res) => res.json({ models: AVAILABLE_MODELS }));

export default router;
