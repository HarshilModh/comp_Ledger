import { generateAnswer, AVAILABLE_MODELS } from '../services/generate.js';
import { decompose } from '../services/decompose.js';
import { embedText } from '../services/embed.js';
import { retrieveCandidates } from '../services/retrieve.js';
import { scoreClaim, computeExclusivityScore } from '../services/score.js';

async function traceAnswer(question, answer) {
  const claims = await decompose(question, answer);

  return Promise.all(claims.map(async (claim) => {
    try {
      const vector = await embedText(claim.text);
      const { publisherHits, referenceHits } = retrieveCandidates(vector);
      const scoreResult = await scoreClaim(claim.text, publisherHits, referenceHits);
      const exclusivityScore = computeExclusivityScore(
        scoreResult.exclusivity?.independent_source_count || 0,
        scoreResult.fingerprint?.detected || false,
      );
      return { claim_id: claim.id, claim_text: claim.text, ...scoreResult, exclusivity_score: exclusivityScore };
    } catch (err) {
      return { claim_id: claim.id, claim_text: claim.text, scoring_failed: true, exclusivity_score: 0 };
    }
  }));
}

export default async function multiTraceRoutes(fastify) {
  fastify.post('/api/multi-trace', async (request, reply) => {
    const { question, modelIds } = request.body;

    const models = modelIds?.length
      ? AVAILABLE_MODELS.filter(m => modelIds.includes(m.id))
      : AVAILABLE_MODELS;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const write = (type, data) =>
      reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

    write('models', { models: models.map(m => ({ id: m.id, label: m.label })) });

    // Generate answers from all models in parallel, then trace each
    await Promise.all(models.map(async (model) => {
      try {
        write('model_start', { modelId: model.id });

        const answer = await generateAnswer(question, model.id);
        write('model_answer', { modelId: model.id, answer });

        const claims = await traceAnswer(question, answer);
        write('model_done', { modelId: model.id, claims });
      } catch (err) {
        write('model_error', { modelId: model.id, error: err.message });
      }
    }));

    write('done', {});
    reply.raw.end();
  });

  fastify.get('/api/models', async () => ({ models: AVAILABLE_MODELS }));
}
