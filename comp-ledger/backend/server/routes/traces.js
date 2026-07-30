import { Router } from 'express';
import { query } from '../lib/db.js';

const router = Router();

router.get('/api/traces', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const result = await query(
    `SELECT id, question, answer, mode, claims, model_id, created_at FROM traces ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json({ traces: result.rows });
});

router.get('/api/traces/:id', async (req, res) => {
  const result = await query(
    'SELECT id, question, answer, mode, claims, model_id, created_at FROM traces WHERE id = $1',
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Trace not found' });
  res.json(result.rows[0]);
});

export default router;
