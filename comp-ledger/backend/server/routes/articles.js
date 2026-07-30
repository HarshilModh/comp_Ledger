import { z } from 'zod';
import { Router } from 'express';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { query } from '../lib/db.js';
import { sanitizeText, sanitizeTitle, sanitizeUrl } from '../lib/sanitize.js';
import { ingestArticle, removeArticleEmbeddings } from '../services/article-ingest.js';
import { pollPublisherRss } from '../services/rss-poller.js';
import { pullFromPublisherApi } from '../services/publisher-pull.js';

const router = Router();

const articleSchema = z.object({
  title: z.string().min(1).max(500),
  body_text: z.string().min(50),
  url: z.string().url().optional().nullable(),
  byline: z.string().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
});

const bulkSchema = z.object({ articles: z.array(articleSchema).min(1).max(100) });

function slugify(title, idx = 0) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return idx > 0 ? `${base}-${idx}` : base;
}

router.post('/api/publishers/:id/articles', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT id FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const parsed = articleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { title, body_text, url, byline, published_at } = parsed.data;
  const slug = slugify(title);
  const insertResult = await query(
    `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (publisher_id, slug) DO UPDATE
     SET title = EXCLUDED.title, body_text = EXCLUDED.body_text,
         url = EXCLUDED.url, byline = EXCLUDED.byline, published_at = EXCLUDED.published_at
     RETURNING *`,
    [publisherId, title, url || null, slug, body_text, byline || null, published_at || null]
  );
  const article = insertResult.rows[0];
  const { chunks_count } = await ingestArticle({ slug, body_text }, publisherId);
  await query(
    `INSERT INTO ingest_log (publisher_id, method, articles_imported, details) VALUES ($1, 'manual', 1, $2)`,
    [publisherId, JSON.stringify({ title })]
  );
  res.status(201).json({ ...article, chunks_count });
});

router.post('/api/publishers/:id/articles/bulk', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT id FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const results = { imported: 0, failed: 0, errors: [] };
  for (let i = 0; i < parsed.data.articles.length; i++) {
    const { title, body_text, url, byline, published_at } = parsed.data.articles[i];
    const slug = slugify(title, i);
    try {
      await query(
        `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (publisher_id, slug) DO UPDATE
         SET title = EXCLUDED.title, body_text = EXCLUDED.body_text,
             url = EXCLUDED.url, byline = EXCLUDED.byline, published_at = EXCLUDED.published_at`,
        [publisherId, title, url || null, slug, body_text, byline || null, published_at || null]
      );
      await ingestArticle({ slug, body_text }, publisherId);
      results.imported++;
    } catch (err) {
      results.failed++;
      results.errors.push({ title, error: err.message });
    }
  }
  await query(
    `INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_failed, details)
     VALUES ($1, 'bulk-json', $2, $3, $4)`,
    [publisherId, results.imported, results.failed, JSON.stringify({ total: parsed.data.articles.length })]
  );
  res.json(results);
});

router.post('/api/publishers/:id/articles/url', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT id FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const parsed = z.object({ url: z.string().url() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { url } = parsed.data;
  let html;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoMP-Ledger/1.0)' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(400).json({ error: `Failed to fetch URL: HTTP ${r.status}` });
    html = await r.text();
  } catch (err) {
    return res.status(400).json({ error: `Failed to fetch URL: ${err.message}` });
  }

  const { document } = parseHTML(html);
  const reader = new Readability(document);
  const article = reader.parse();
  if (!article?.textContent || article.textContent.length < 50)
    return res.status(400).json({ error: 'Could not extract article content from URL' });

  const title = sanitizeTitle(article.title || url);
  const bodyText = sanitizeText(article.textContent);
  const byline = article.byline ? sanitizeTitle(article.byline) : null;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

  if (bodyText.length < 50) return res.status(400).json({ error: 'Extracted content too short after sanitization' });

  const insertResult = await query(
    `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (publisher_id, slug) DO UPDATE
     SET title = EXCLUDED.title, body_text = EXCLUDED.body_text, url = EXCLUDED.url, byline = EXCLUDED.byline
     RETURNING *`,
    [publisherId, title, sanitizeUrl(url), slug, bodyText, byline]
  );
  const saved = insertResult.rows[0];
  const { chunks_count } = await ingestArticle({ slug, body_text: bodyText }, publisherId);
  await query(
    `INSERT INTO ingest_log (publisher_id, method, articles_imported, details) VALUES ($1, 'url', 1, $2)`,
    [publisherId, JSON.stringify({ url, title })]
  );
  res.status(201).json({ ...saved, chunks_count });
});

router.post('/api/publishers/:id/rss/poll', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT * FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const publisher = pubResult.rows[0];
  if (!publisher.rss_url) return res.status(400).json({ error: 'No RSS URL configured for this publisher' });

  const result = await pollPublisherRss(publisher);
  await query(
    `INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_skipped, articles_failed)
     VALUES ($1, 'rss', $2, $3, $4)`,
    [publisherId, result.new_articles || 0, result.skipped || 0, result.failed || 0]
  );
  res.json(result);
});

router.get('/api/publishers/:id/articles', async (req, res) => {
  const { id: publisherId } = req.params;
  const { limit = 50, offset = 0, search = '' } = req.query;

  const hasSearch = search.trim().length > 0;
  const searchFilter = hasSearch ? `AND (title ILIKE $2 OR url ILIKE $2 OR byline ILIKE $2)` : '';
  const searchPattern = `%${search.trim()}%`;

  const countResult = await query(
    `SELECT count(*) FROM articles WHERE publisher_id = $1 AND status = 'active' ${searchFilter}`,
    hasSearch ? [publisherId, searchPattern] : [publisherId]
  );

  const listFilter = hasSearch ? `AND (title ILIKE $4 OR url ILIKE $4 OR byline ILIKE $4)` : '';
  const result = await query(
    `SELECT id, title, url, slug, byline, published_at, ingested_at, status
     FROM articles WHERE publisher_id = $1 AND status = 'active' ${listFilter}
     ORDER BY ingested_at DESC LIMIT $2 OFFSET $3`,
    hasSearch ? [publisherId, parseInt(limit), parseInt(offset), searchPattern] : [publisherId, parseInt(limit), parseInt(offset)]
  );

  res.json({ articles: result.rows, total: parseInt(countResult.rows[0].count), limit: parseInt(limit), offset: parseInt(offset) });
});

router.delete('/api/publishers/:id/articles/:articleId', async (req, res) => {
  const { id: publisherId, articleId } = req.params;
  const result = await query(
    `UPDATE articles SET status = 'archived' WHERE id = $1 AND publisher_id = $2 RETURNING slug`,
    [articleId, publisherId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Article not found' });
  await removeArticleEmbeddings(result.rows[0].slug, publisherId);
  res.json({ success: true });
});

router.get('/api/publishers/:id/stats', async (req, res) => {
  const { id: publisherId } = req.params;
  const [articlesResult, embeddingsResult, tracesResult, slugsResult] = await Promise.all([
    query(`SELECT count(*) as total FROM articles WHERE publisher_id = $1 AND status = 'active'`, [publisherId]),
    query(`SELECT count(*) as total FROM embeddings WHERE publisher_id = $1`, [publisherId]),
    query(`SELECT id, claims, created_at FROM traces ORDER BY created_at DESC LIMIT 200`),
    query(`SELECT slug FROM articles WHERE publisher_id = $1 AND status = 'active'`, [publisherId]),
  ]);

  const publisherSlugs = new Set(slugsResult.rows.map(r => r.slug));
  let totalCitations = 0, tracesWithCitations = 0;
  const citedArticles = {};

  for (const trace of tracesResult.rows) {
    let traceHasCitation = false;
    for (const claim of (trace.claims || [])) {
      const matchSlug = claim.match?.source_slug || claim.match?.slug || '';
      if (matchSlug && publisherSlugs.has(matchSlug)) {
        totalCitations++;
        traceHasCitation = true;
        citedArticles[matchSlug] = (citedArticles[matchSlug] || 0) + 1;
      }
    }
    if (traceHasCitation) tracesWithCitations++;
  }

  const topCited = Object.entries(citedArticles).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([slug, count]) => ({ slug, citations: count }));
  const recentActivity = await query(
    `SELECT method, articles_imported, created_at FROM ingest_log WHERE publisher_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [publisherId]
  );

  res.json({
    articles: parseInt(articlesResult.rows[0].total),
    embeddings: parseInt(embeddingsResult.rows[0].total),
    total_citations: totalCitations,
    traces_with_citations: tracesWithCitations,
    top_cited: topCited,
    recent_activity: recentActivity.rows,
  });
});

router.get('/api/publishers/:id/activity', async (req, res) => {
  const { id: publisherId } = req.params;
  const { limit = 20 } = req.query;
  const result = await query(
    `SELECT * FROM ingest_log WHERE publisher_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [publisherId, parseInt(limit)]
  );
  res.json({ entries: result.rows });
});

router.post('/api/publishers/:id/articles/bulk-url', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT id FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const parsed = z.object({ urls: z.array(z.string().url()).min(1).max(20) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const results = { imported: 0, failed: 0, errors: [] };
  for (const url of parsed.data.urls) {
    try {
      let html;
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoMP-Ledger/1.0)' }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        html = await r.text();
      } catch (err) {
        results.failed++; results.errors.push({ url, error: `Fetch failed: ${err.message}` }); continue;
      }

      const { document } = parseHTML(html);
      const reader = new Readability(document);
      const article = reader.parse();
      if (!article?.textContent || article.textContent.length < 50) {
        results.failed++; results.errors.push({ url, error: 'Could not extract content' }); continue;
      }

      const title = sanitizeTitle(article.title || url);
      const bodyText = sanitizeText(article.textContent);
      const byline = article.byline ? sanitizeTitle(article.byline) : null;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

      if (bodyText.length < 50) {
        results.failed++; results.errors.push({ url, error: 'Content too short after sanitization' }); continue;
      }

      await query(
        `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (publisher_id, slug) DO UPDATE
         SET title = EXCLUDED.title, body_text = EXCLUDED.body_text, url = EXCLUDED.url, byline = EXCLUDED.byline`,
        [publisherId, title, sanitizeUrl(url), slug, bodyText, byline]
      );
      await ingestArticle({ slug, body_text: bodyText }, publisherId);
      results.imported++;
    } catch (err) {
      results.failed++; results.errors.push({ url, error: err.message });
    }
  }

  await query(
    `INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_skipped, articles_failed, details)
     VALUES ($1, 'bulk-url', $2, 0, $3, $4)`,
    [publisherId, results.imported, results.failed, JSON.stringify({ urls: parsed.data.urls.length })]
  );
  res.json(results);
});

router.put('/api/publishers/:id/pull-schedule', async (req, res) => {
  const { id: publisherId } = req.params;
  const { schedule } = req.body || {};
  if (!([null, 'hourly', 'daily', 'weekly'].includes(schedule)))
    return res.status(400).json({ error: 'Invalid schedule. Use: hourly, daily, weekly, or null to disable.' });
  await query(`UPDATE publishers SET pull_schedule = $1, updated_at = now() WHERE id = $2`, [schedule, publisherId]);
  res.json({ success: true, schedule });
});

router.put('/api/publishers/:id/pull-config', async (req, res) => {
  const { id: publisherId } = req.params;
  const configSchema = z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST']).default('GET'),
    headers: z.record(z.string()).default({}),
    response_path: z.string().optional().default(''),
    mapping: z.object({
      title: z.string().default('title'),
      body_text: z.string().default('body_text'),
      url: z.string().default('url'),
      byline: z.string().default('byline'),
      published_at: z.string().default('published_at'),
    }).default({}),
    pagination: z.object({
      type: z.enum(['none', 'offset', 'cursor']).default('none'),
      param: z.string().default('page'),
      limit_param: z.string().default('per_page'),
      limit: z.number().default(20),
    }).default({ type: 'none', param: 'page', limit_param: 'per_page', limit: 20 }),
  });
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await query(`UPDATE publishers SET pull_config = $1, updated_at = now() WHERE id = $2`, [JSON.stringify(parsed.data), publisherId]);
  res.json({ success: true, config: parsed.data });
});

router.delete('/api/publishers/:id/pull-config', async (req, res) => {
  await query(`UPDATE publishers SET pull_config = NULL, updated_at = now() WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

router.post('/api/publishers/:id/pull', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT * FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const publisher = pubResult.rows[0];
  if (!publisher.pull_config) return res.status(400).json({ error: 'No pull configuration set. Configure the publisher API first.' });

  const result = await pullFromPublisherApi(publisher);
  if (result.success) {
    await query(
      `INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_skipped, articles_failed, details)
       VALUES ($1, 'pull-api', $2, $3, $4, $5)`,
      [publisherId, result.imported || 0, result.skipped || 0, result.failed || 0, JSON.stringify({ total_fetched: result.total_fetched })]
    );
  }
  res.json(result);
});

router.post('/api/publishers/:id/pull-test', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT * FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const publisher = pubResult.rows[0];
  if (!publisher.pull_config) return res.json({ success: false, message: 'No pull configuration set.' });

  const { url, headers = {}, response_path, mapping = {} } = publisher.pull_config;
  try {
    const { curlGet } = await import('../services/research/http.js');
    const curlHeaders = Object.entries(headers).reduce((acc, [k, v]) => { acc.push('-H', `${k}: ${v}`); return acc; }, []);
    const response = await curlGet(url, 15000, curlHeaders);
    if (!response) return res.json({ success: false, message: 'No response from API (timeout or connection refused)' });

    let parsed;
    try { parsed = JSON.parse(response); } catch { return res.json({ success: false, message: 'Response is not valid JSON', preview: response.slice(0, 200) }); }

    let articles = parsed;
    if (response_path) {
      for (const key of response_path.split('.')) articles = articles?.[key];
    }

    if (!Array.isArray(articles))
      return res.json({ success: false, message: `Expected an array at path "${response_path || '(root)'}". Got: ${typeof articles}`, keys: parsed ? Object.keys(parsed).slice(0, 10) : [] });

    const preview = articles.slice(0, 3).map(a => ({
      title: a[mapping.title || 'title'] || '(missing)',
      body_length: (a[mapping.body_text || 'content'] || '').length,
      url: a[mapping.url || 'url'] || null,
    }));
    res.json({ success: true, message: `Connected! Found ${articles.length} articles on this page.`, total_on_page: articles.length, preview });
  } catch (err) {
    res.json({ success: false, message: `Connection failed: ${err.message}` });
  }
});

router.post('/api/publishers/:id/crawl', async (req, res) => {
  const { id: publisherId } = req.params;
  const pubResult = await query('SELECT * FROM publishers WHERE id = $1 AND status = $2', [publisherId, 'active']);
  if (!pubResult.rows.length) return res.status(404).json({ error: 'Publisher not found' });

  const publisher = pubResult.rows[0];
  const domain = publisher.domain;

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  const write = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

  const { curlGet } = await import('../services/research/http.js');

  write('status', { message: `Probing ${domain} for sitemaps and feeds…` });

  const articleUrls = [];
  const seen = new Set();

  function addUrl(url) {
    if (!url || seen.has(url)) return;
    try { new URL(url); } catch { return; }
    if (!url.startsWith('http')) return;
    seen.add(url);
    articleUrls.push(url);
  }

  const bare = domain.replace(/^www\./, '');
  const probeTargets = [
    `https://${domain}/sitemap.xml`, `https://www.${bare}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`, `https://${domain}/news-sitemap.xml`,
    `https://${domain}/feed`, `https://www.${bare}/feed`,
    `https://${domain}/rss`, `https://${domain}/feed.xml`, `https://${domain}/rss.xml`,
    `https://rss.${bare}/services/xml/rss/nyt/HomePage.xml`,
    `https://feeds.${bare}/~r/${bare}/~3/all`,
  ];
  if (publisher.rss_url) probeTargets.unshift(publisher.rss_url);

  let foundSomething = false;
  const UA = ['-A', 'Mozilla/5.0 (compatible; CoMP-Ledger/1.0)', '-L', '--max-redirs', '3'];

  for (const target of probeTargets) {
    const content = await curlGet(target, 12000, UA);
    if (!content || content.length < 100) continue;

    const isSitemap = content.includes('<urlset') || content.includes('<sitemapindex');
    const isRss = content.includes('<rss') || content.includes('<feed') || content.includes('<channel');

    if (isSitemap) {
      const subMatches = [...content.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)];
      const subSitemaps = subMatches.map(m => m[1]).filter(u => u.includes('sitemap'));
      for (const sub of subSitemaps.slice(0, 5)) {
        const subContent = await curlGet(sub, 10000);
        if (!subContent) continue;
        [...subContent.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]).filter(u => !u.includes('sitemap')).forEach(addUrl);
      }
      [...content.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]).filter(u => !u.includes('sitemap') && !u.includes('.xml')).forEach(addUrl);
      if (articleUrls.length > 0) { foundSomething = true; write('status', { message: `Found ${articleUrls.length} URLs in sitemap` }); break; }
    }

    if (isRss) {
      const rssUrls = [...content.matchAll(/<link>(https?:\/\/[^<]+)<\/link>/g)].map(m => m[1].trim()).filter(u => u.includes(bare));
      const atomUrls = [...content.matchAll(/<link[^>]+href="(https?:\/\/[^"]+)"/g)].map(m => m[1]).filter(u => !u.includes('.xml') && !u.includes('feed') && !u.includes('rss'));
      [...rssUrls, ...atomUrls].forEach(addUrl);
      if (articleUrls.length > 0) { foundSomething = true; write('status', { message: `Found ${articleUrls.length} URLs in RSS/Atom feed` }); break; }
    }
  }

  if (!foundSomething || articleUrls.length === 0) {
    write('error', { message: `Could not discover any article URLs on ${domain}. Try adding an RSS feed URL manually in Settings.` });
    return res.end();
  }

  const toProcess = articleUrls.slice(0, 100);
  write('discovered', { total: toProcess.length });

  let imported = 0, skipped = 0, failed = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const url = toProcess[i];
    write('progress', { current: i + 1, total: toProcess.length, url, imported, skipped, failed });

    try {
      const html = await curlGet(url, 12000, ['-H', 'User-Agent: Mozilla/5.0 (compatible; CoMP-Ledger/1.0)', '-L', '--max-redirs', '3']);
      if (!html || html.length < 500) { failed++; continue; }

      const { document } = parseHTML(html);
      const reader = new Readability(document);
      const article = reader.parse();
      if (!article?.textContent || article.textContent.length < 100) { skipped++; continue; }

      const title = sanitizeTitle(article.title || url);
      const bodyText = sanitizeText(article.textContent);
      const byline = article.byline ? sanitizeTitle(article.byline) : null;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

      if (bodyText.length < 100) { skipped++; continue; }

      const insertResult = await query(
        `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (publisher_id, slug) DO NOTHING RETURNING id`,
        [publisherId, title, sanitizeUrl(url), slug, bodyText, byline]
      );
      if (!insertResult.rows.length) { skipped++; continue; }

      await ingestArticle({ slug, body_text: bodyText }, publisherId);
      imported++;
    } catch { failed++; }
  }

  await query(
    `INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_skipped, articles_failed, details)
     VALUES ($1, 'crawl', $2, $3, $4, $5)`,
    [publisherId, imported, skipped, failed, JSON.stringify({ domain, total: toProcess.length })]
  );

  write('done', { imported, skipped, failed, total: toProcess.length });
  res.end();
});

export default router;
