import { randomBytes } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { ingestArticle } from '../services/article-ingest.js';

const router = Router();

const articleSchema = z.object({
  title: z.string().min(1).max(500),
  body_text: z.string().min(50),
  url: z.string().url().optional().nullable(),
  byline: z.string().optional().nullable(),
  published_at: z.string().optional().nullable(),
});

const batchSchema = z.object({ articles: z.array(articleSchema).min(1).max(50) });

function slugify(title, idx = 0) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return idx > 0 ? `${base}-${idx}` : base;
}

async function authenticateApiKey(req, res) {
  const auth = req.headers['authorization'] || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : req.headers['x-api-key']?.trim();
  if (!key) { res.status(401).json({ error: 'Missing API key' }); return null; }
  const result = await query(`SELECT * FROM publishers WHERE api_key = $1 AND status = 'active'`, [key]);
  if (!result.rows.length) { res.status(403).json({ error: 'Invalid or inactive API key' }); return null; }
  return result.rows[0];
}

router.post('/api/ingest', async (req, res) => {
  const publisher = await authenticateApiKey(req, res);
  if (!publisher) return;
  const parsed = articleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { title, body_text, url, byline, published_at } = parsed.data;
  const slug = slugify(title);
  const insertResult = await query(
    `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (publisher_id, slug) DO UPDATE
     SET title = EXCLUDED.title, body_text = EXCLUDED.body_text, url = EXCLUDED.url, byline = EXCLUDED.byline, published_at = EXCLUDED.published_at
     RETURNING id, title, slug, ingested_at`,
    [publisher.id, title, url || null, slug, body_text, byline || null, published_at || null]
  );
  const article = insertResult.rows[0];
  const { chunks_count } = await ingestArticle({ slug, body_text }, publisher.id);
  await query(`INSERT INTO ingest_log (publisher_id, method, articles_imported, details) VALUES ($1, 'push-api', 1, $2)`,
    [publisher.id, JSON.stringify({ title })]);
  res.status(201).json({ success: true, article_id: article.id, title: article.title, slug: article.slug, chunks_indexed: chunks_count });
});

router.post('/api/ingest/batch', async (req, res) => {
  const publisher = await authenticateApiKey(req, res);
  if (!publisher) return;
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const results = { imported: 0, failed: 0, articles: [] };
  for (let i = 0; i < parsed.data.articles.length; i++) {
    const { title, body_text, url, byline, published_at } = parsed.data.articles[i];
    const slug = slugify(title, i);
    try {
      const r = await query(
        `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (publisher_id, slug) DO UPDATE SET title = EXCLUDED.title, body_text = EXCLUDED.body_text
         RETURNING id, title, slug`,
        [publisher.id, title, url || null, slug, body_text, byline || null, published_at || null]
      );
      const { chunks_count } = await ingestArticle({ slug, body_text }, publisher.id);
      results.imported++;
      results.articles.push({ id: r.rows[0].id, title, chunks: chunks_count });
    } catch (err) {
      results.failed++;
      results.articles.push({ title, error: err.message });
    }
  }
  res.json(results);
});

router.post('/api/webhook/:publisherId', async (req, res) => {
  const { publisherId } = req.params;
  const pubResult = await query(`SELECT * FROM publishers WHERE id = $1 AND status = 'active'`, [publisherId]);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const publisher = pubResult.rows[0];
  const token = req.headers['x-webhook-secret'] || req.headers['x-api-key'] || '';
  if (publisher.api_key && token !== publisher.api_key) return res.status(403).json({ error: 'Invalid webhook secret' });

  const parsed = articleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { title, body_text, url, byline, published_at } = parsed.data;
  const slug = slugify(title);
  const r = await query(
    `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (publisher_id, slug) DO UPDATE SET title = EXCLUDED.title, body_text = EXCLUDED.body_text
     RETURNING id, title, slug, ingested_at`,
    [publisher.id, title, url || null, slug, body_text, byline || null, published_at || null]
  );
  const { chunks_count } = await ingestArticle({ slug, body_text }, publisher.id);
  res.status(201).json({ success: true, article_id: r.rows[0].id, title: r.rows[0].title, chunks_indexed: chunks_count });
});

router.post('/api/publishers/:id/api-key', async (req, res) => {
  const { id } = req.params;
  const result = await query('SELECT id FROM publishers WHERE id = $1 AND status = $2', [id, 'active']);
  if (!result.rows.length) return res.status(404).json({ error: 'Publisher not found' });
  const apiKey = `cl_${randomBytes(24).toString('hex')}`;
  await query(`UPDATE publishers SET api_key = $1, updated_at = now() WHERE id = $2`, [apiKey, id]);
  res.json({ api_key: apiKey });
});

router.delete('/api/publishers/:id/api-key', async (req, res) => {
  await query(`UPDATE publishers SET api_key = NULL, updated_at = now() WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

export default router;
