import { readFileSync, existsSync } from 'fs';
import { decompose } from '../services/decompose.js';
import { embedText } from '../services/embed.js';
import { retrieveCandidates } from '../services/retrieve.js';
import { scoreClaim, computeExclusivityScore } from '../services/score.js';
import { query } from '../lib/db.js';

export default async function traceRoutes(fastify) {
  fastify.post('/api/trace', async (request, reply) => {
    const { question, answer, mode = 'audit' } = request.body;

    if (request.query.mock === 'true') {
      const fallbackPath = './data/demo-fallback.json';
      if (existsSync(fallbackPath)) {
        const fallback = JSON.parse(readFileSync(fallbackPath, 'utf-8'));
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        for (const event of fallback.events) {
          reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
          await new Promise(r => setTimeout(r, 600));
        }
        reply.raw.write(`event: done\ndata: {}\n\n`);
        reply.raw.end();
        return;
      }
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      const claims = await decompose(question, answer);
      reply.raw.write(`event: claims_count\ndata: ${JSON.stringify({ total: claims.length })}\n\n`);

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

          const event = {
            claim_id: claim.id,
            claim_text: claim.text,
            mode,
            ...scoreResult,
            exclusivity_score: exclusivityScore,
          };

          scoredClaims.push(event);
          reply.raw.write(`event: claim_scored\ndata: ${JSON.stringify(event)}\n\n`);
        } catch (err) {
          const errorEvent = {
            claim_id: claim.id,
            claim_text: claim.text,
            mode,
            scoring_failed: true,
            error: err.message,
            exclusivity_score: 0,
          };
          scoredClaims.push(errorEvent);
          reply.raw.write(`event: claim_scored\ndata: ${JSON.stringify(errorEvent)}\n\n`);
        }
      }

      reply.raw.write(`event: done\ndata: {}\n\n`);
      reply.raw.end();

      try {
        await query(
          'INSERT INTO traces (question, answer, mode, claims) VALUES ($1, $2, $3, $4)',
          [question, answer, mode, JSON.stringify(scoredClaims)]
        );
      } catch (_) {}

    } catch (err) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      reply.raw.end();
    }
  });
}
