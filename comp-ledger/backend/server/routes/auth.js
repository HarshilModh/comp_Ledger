import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'comp-ledger-dev-secret-change-in-prod';
const JWT_EXPIRES = '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

function signToken(publisher) {
  return jwt.sign(
    { id: publisher.id, email: publisher.email, role: publisher.role || 'publisher' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/token=([^;]+)/);
  return m ? m[1] : null;
}

export function authMiddleware(requireAdmin = false) {
  return (req, res, next) => {
    const t = getTokenFromRequest(req);
    if (!t) return res.status(401).json({ error: 'Authentication required' });
    const payload = verifyToken(t);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
    if (requireAdmin && payload.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = payload;
    next();
  };
}

function setTokenCookie(res, token) {
  res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}`);
}

// POST /api/auth/register
router.post('/api/auth/register', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    password: z.string().min(6).max(100),
    publication: z.string().min(1).max(300),
    domain: z.string().min(3).max(200),
    alt_domains: z.array(z.string()).default([]),
    rss_url: z.string().url().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, password, publication, domain, alt_domains, rss_url } = parsed.data;

  const existing = await query('SELECT id FROM publishers WHERE email = $1', [email]);
  if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

  const domainCheck = await query('SELECT id FROM publishers WHERE domain = $1', [domain.toLowerCase()]);
  if (domainCheck.rows.length) return res.status(409).json({ error: 'Domain already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO publishers (name, email, password_hash, publication, domain, alt_domains, rss_url, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'publisher')
     RETURNING id, name, email, publication, domain, role, created_at`,
    [name, email, passwordHash, publication, domain.toLowerCase(), alt_domains, rss_url || null]
  );
  const publisher = result.rows[0];
  const token = signToken(publisher);
  setTokenCookie(res, token);
  res.status(201).json({ token, publisher });
});

// POST /api/auth/login
router.post('/api/auth/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password' });

  const { email, password } = parsed.data;
  const result = await query(
    `SELECT id, name, email, password_hash, publication, domain, role, status FROM publishers WHERE email = $1`,
    [email]
  );
  if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password' });

  const publisher = result.rows[0];
  if (publisher.status !== 'active') return res.status(403).json({ error: 'Account is suspended' });
  if (!publisher.password_hash) return res.status(401).json({ error: 'No password set. Please contact admin.' });

  const valid = await bcrypt.compare(password, publisher.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(publisher);
  setTokenCookie(res, token);
  res.json({ token, publisher: { id: publisher.id, name: publisher.name, email: publisher.email, publication: publisher.publication, domain: publisher.domain, role: publisher.role } });
});

// GET /api/auth/me
router.get('/api/auth/me', async (req, res) => {
  const t = getTokenFromRequest(req);
  if (!t) return res.status(401).json({ error: 'Not authenticated' });
  const payload = verifyToken(t);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  const result = await query(
    `SELECT id, name, email, publication, domain, role, status, created_at FROM publishers WHERE id = $1`,
    [payload.id]
  );
  if (!result.rows.length) return res.status(401).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

// POST /api/auth/logout
router.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ success: true });
});

// PUT /api/auth/change-password
router.put('/api/auth/change-password', async (req, res) => {
  const t = getTokenFromRequest(req);
  if (!t) return res.status(401).json({ error: 'Not authenticated' });
  const payload = verifyToken(t);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });

  const schema = z.object({ current_password: z.string().min(1), new_password: z.string().min(6).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await query('SELECT password_hash FROM publishers WHERE id = $1', [payload.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(parsed.data.current_password, result.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = await bcrypt.hash(parsed.data.new_password, 10);
  await query('UPDATE publishers SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, payload.id]);
  res.json({ success: true });
});

// GET /api/auth/google/config
router.get('/api/auth/google/config', (req, res) => {
  res.json({ client_id: GOOGLE_CLIENT_ID, enabled: !!GOOGLE_CLIENT_ID });
});

// POST /api/auth/google
router.post('/api/auth/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(501).json({ error: 'Google auth not configured' });

  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Missing Google credential token' });

  let payload;
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (decoded.aud !== GOOGLE_CLIENT_ID) throw new Error('Token audience mismatch');
    if (decoded.exp && decoded.exp < Date.now() / 1000) throw new Error('Token expired');
    payload = decoded;
  } catch (err) {
    return res.status(401).json({ error: `Invalid Google token: ${err.message}` });
  }

  const { email, name } = payload;
  if (!email) return res.status(400).json({ error: 'Google account has no email' });

  let result = await query('SELECT * FROM publishers WHERE email = $1', [email]);
  if (!result.rows.length) {
    const domain = email.split('@')[1] || 'unknown.com';
    const domainCheck = await query('SELECT id FROM publishers WHERE domain = $1', [domain]);
    const finalDomain = domainCheck.rows.length ? `${domain}-${Date.now()}` : domain;
    result = await query(
      `INSERT INTO publishers (name, email, publication, domain, role) VALUES ($1, $2, $3, $4, 'publisher') RETURNING *`,
      [name || email, email, name || email.split('@')[0], finalDomain]
    );
  }

  const publisher = result.rows[0];
  if (publisher.status !== 'active') return res.status(403).json({ error: 'Account is suspended' });

  const token = signToken(publisher);
  setTokenCookie(res, token);
  res.json({ token, publisher: { id: publisher.id, name: publisher.name, email: publisher.email, publication: publisher.publication, domain: publisher.domain, role: publisher.role } });
});

export default router;
