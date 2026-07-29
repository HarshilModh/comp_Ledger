import { query } from '../lib/db.js';

export default async function tracesRoutes(fastify) {
  fastify.get('/api/traces', async (request) => {
    const limit = Math.min(parseInt(request.query.limit) || 50, 200);
    const offset = parseInt(request.query.offset) || 0;

    const result = await query(
      `SELECT id, question, answer, mode, claims, model_id, created_at
       FROM traces ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return { traces: result.rows };
  });

  fastify.get('/api/traces/:id', async (request, reply) => {
    const { id } = request.params;
    const result = await query(
      'SELECT id, question, answer, mode, claims, model_id, created_at FROM traces WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Trace not found' });
    }
    return result.rows[0];
  });
}
