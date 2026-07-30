import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { verifyToken, getTokenFromRequest } from './auth.js';

const router = Router();

function getUser(req) {
  const t = getTokenFromRequest(req);
  if (!t) return null;
  return verifyToken(t);
}

const createSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  publication: z.string().min(2).max(200),
  domain: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i),
  alt_domains: z.array(z.string()).optional().default([]),
  rss_url: z.string().url().optional().nullable(),
});
const updateSchema = createSchema.partial();

router.post('/api/publishers', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, email, publication, domain, alt_domains, rss_url } = parsed.data;
  const result = await query(
    `INSERT INTO publishers (name, email, publication, domain, alt_domains, rss_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, email, publication, domain.toLowerCase(), alt_domains, rss_url || null]
  );
  res.status(201).json(result.rows[0]);
});

router.get('/api/publishers', async (req, res) => {
  const user = getUser(req);
  let result;
  if (user?.role === 'admin') {
    result = await query(`SELECT * FROM publishers WHERE status = 'active' ORDER BY created_at DESC`);
  } else if (user) {
    result = await query(`SELECT * FROM publishers WHERE id = $1 AND status = 'active'`, [user.id]);
  } else {
    result = await query(`SELECT * FROM publishers WHERE status = 'active' ORDER BY created_at DESC`);
  }
  res.json(result.rows.map(r => { delete r.password_hash; return r; }));
});

router.get('/api/publishers/:id', async (req, res) => {
  const { id } = req.params;
  const user = getUser(req);
  if (user && user.role !== 'admin' && user.id !== id) return res.status(403).json({ error: 'Access denied' });
  const result = await query('SELECT * FROM publishers WHERE id = $1', [id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Publisher not found' });
  const pub = result.rows[0];
  delete pub.password_hash;
  res.json(pub);
});

router.put('/api/publishers/:id', async (req, res) => {
  const { id } = req.params;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const fields = parsed.data;
  if (!Object.keys(fields).length) return res.status(400).json({ error: 'No fields to update' });

  const setClauses = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`);
    values.push(key === 'domain' ? value.toLowerCase() : value);
    idx++;
  }
  setClauses.push(`updated_at = now()`);
  values.push(id);

  const result = await query(
    `UPDATE publishers SET ${setClauses.join(', ')} WHERE id = $${idx} AND status != 'suspended' RETURNING *`,
    values
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Publisher not found' });
  res.json(result.rows[0]);
});

router.delete('/api/publishers/:id', async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE publishers SET status = 'suspended', updated_at = now() WHERE id = $1 RETURNING id`, [id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Publisher not found' });
  res.json({ success: true });
});

export default router;
