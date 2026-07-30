import { query } from '../lib/db.js';
import { ingestArticle } from './article-ingest.js';
import { curlGet } from './research/http.js';

function slugify(title, idx = 0) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return idx > 0 ? `${base}-${idx}` : base;
}

function getNestedValue(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function mapArticle(raw, mapping) {
  return {
    title: raw[mapping.title || 'title'] || '',
    body_text: raw[mapping.body_text || 'body_text'] || raw[mapping.body_text || 'content'] || '',
    url: raw[mapping.url || 'url'] || null,
    byline: raw[mapping.byline || 'byline'] || raw[mapping.byline || 'author'] || null,
    published_at: raw[mapping.published_at || 'published_at'] || null,
  };
}

export async function pullFromPublisherApi(publisher) {
  const { id: publisherId, pull_config: config } = publisher;

  if (!config || !config.url) {
    return { success: false, reason: 'No pull config or URL set' };
  }

  const { url, method = 'GET', headers = {}, mapping = {}, pagination, response_path } = config;

  let allArticles = [];
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    let fetchUrl = url;

    if (pagination && pagination.type === 'offset') {
      const sep = fetchUrl.includes('?') ? '&' : '?';
      fetchUrl += `${sep}${pagination.param || 'page'}=${page}`;
      if (pagination.limit_param) {
        fetchUrl += `&${pagination.limit_param}=${pagination.limit || 20}`;
      }
    } else if (pagination && pagination.type === 'cursor' && page > 1) {
      break;
    }

    let rawResponse;
    try {
      const headersArr = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
      const curlHeaders = Object.entries(headers).reduce((acc, [k, v]) => {
        acc.push('-H', `${k}: ${v}`);
        return acc;
      }, []);

      const response = await curlGet(fetchUrl, 30000, curlHeaders);
      rawResponse = JSON.parse(response);
    } catch (err) {
      if (page === 1) {
        return { success: false, reason: `Failed to fetch: ${err.message}` };
      }
      break;
    }

    const articles = response_path ? getNestedValue(rawResponse, response_path) : rawResponse;

    if (!Array.isArray(articles) || articles.length === 0) break;

    allArticles.push(...articles);

    if (!pagination || pagination.type === 'none') break;
    if (articles.length < (pagination.limit || 20)) break;
    page++;
  }

  if (allArticles.length === 0) {
    return { success: true, imported: 0, reason: 'No articles returned from API' };
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < allArticles.length; i++) {
    const mapped = mapArticle(allArticles[i], mapping);

    if (!mapped.title || !mapped.body_text || mapped.body_text.length < 50) {
      skipped++;
      continue;
    }

    const slug = slugify(mapped.title, i);

    try {
      const existing = await query(
        'SELECT id FROM articles WHERE publisher_id = $1 AND slug = $2',
        [publisherId, slug]
      );
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [publisherId, mapped.title, mapped.url, slug, mapped.body_text, mapped.byline, mapped.published_at]
      );

      await ingestArticle({ slug, body_text: mapped.body_text }, publisherId);
      imported++;
    } catch (err) {
      failed++;
    }
  }

  return { success: true, imported, skipped, failed, total_fetched: allArticles.length };
}
