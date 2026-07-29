import { z } from 'zod';
import { query } from '../lib/db.js';

const createSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  publication: z.string().min(2).max(200),
  domain: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i),
  alt_domains: z.array(z.string()).optional().default([]),
  rss_url: z.string().url().optional().nullable(),
});

const updateSchema = createSchema.partial();

export default async function publisherRoutes(fastify) {
  fastify.post('/api/publishers', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { name, email, publication, domain, alt_domains, rss_url } = parsed.data;

    const result = await query(
      `INSERT INTO publishers (name, email, publication, domain, alt_domains, rss_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, publication, domain.toLowerCase(), alt_domains, rss_url || null]
    );

    return reply.status(201).send(result.rows[0]);
  });

  fastify.get('/api/publishers', async (request, reply) => {
    const result = await query(
      `SELECT * FROM publishers WHERE status = 'active' ORDER BY created_at DESC`
    );
    return result.rows;
  });

  fastify.get('/api/publishers/:id', async (request, reply) => {
    const { id } = request.params;
    const result = await query('SELECT * FROM publishers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Publisher not found' });
    }
    return result.rows[0];
  });

  fastify.put('/api/publishers/:id', async (request, reply) => {
    const { id } = request.params;
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const fields = parsed.data;
    if (Object.keys(fields).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (key === 'domain') {
        setClauses.push(`${key} = $${idx}`);
        values.push(value.toLowerCase());
      } else {
        setClauses.push(`${key} = $${idx}`);
        values.push(value);
      }
      idx++;
    }
    setClauses.push(`updated_at = now()`);
    values.push(id);

    const result = await query(
      `UPDATE publishers SET ${setClauses.join(', ')} WHERE id = $${idx} AND status != 'suspended' RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Publisher not found' });
    }
    return result.rows[0];
  });

  fastify.delete('/api/publishers/:id', async (request, reply) => {
    const { id } = request.params;
    const result = await query(
      `UPDATE publishers SET status = 'suspended', updated_at = now() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Publisher not found' });
    }
    return { success: true };
  });
}
