import { query } from '../lib/db.js';
import { ingestArticle } from './article-ingest.js';
import { curlGet } from './research/http.js';

const POLL_INTERVAL_MS = 30 * 60 * 1000;

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] ||
                  block.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

    const contentEncoded = block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] || '';
    const description = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>(.*?)<\/description>/)?.[1] ||
                        block.match(/<description>(.*?)<\/description>/)?.[1] || '';

    const bodyHtml = contentEncoded || description;
    const bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (title && bodyText.length >= 50) {
      items.push({ title: title.trim(), link: link.trim(), pubDate, bodyText });
    }
  }

  return items;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function pollPublisherRss(publisher) {
  const { id: publisherId, rss_url, publication } = publisher;

  if (!rss_url) return { polled: false, reason: 'No RSS URL' };

  let xml;
  try {
    xml = await curlGet(rss_url, 20000, ['-H', 'User-Agent: CoMP-Ledger/1.0 (fact-checking tool)']);
    if (!xml) return { polled: false, reason: 'No response from RSS feed' };
  } catch (err) {
    return { polled: false, reason: err.message };
  }

  const items = parseRssItems(xml);
  if (items.length === 0) return { polled: true, new_articles: 0 };

  let newCount = 0;

  for (const item of items) {
    const slug = slugify(item.title);

    const existing = await query(
      'SELECT id FROM articles WHERE publisher_id = $1 AND slug = $2',
      [publisherId, slug]
    );
    if (existing.rows.length > 0) continue;

    try {
      await query(
        `INSERT INTO articles (publisher_id, title, url, slug, body_text, published_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          publisherId,
          item.title,
          item.link || null,
          slug,
          item.bodyText,
          item.pubDate ? new Date(item.pubDate).toISOString() : null,
        ]
      );

      await ingestArticle({ slug, body_text: item.bodyText }, publisherId);
      newCount++;
    } catch (err) {
      console.warn(`RSS ingest failed for "${item.title}": ${err.message}`);
    }
  }

  return { polled: true, new_articles: newCount, total_items: items.length };
}

let pollTimer = null;

export function startRssPoller() {
  if (pollTimer) return;

  async function poll() {
    try {
      const result = await query(
        `SELECT * FROM publishers WHERE rss_url IS NOT NULL AND status = 'active'`
      );
      for (const publisher of result.rows) {
        await pollPublisherRss(publisher);
      }
    } catch (err) {
      console.error('RSS poll error:', err.message);
    }
  }

  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  poll();
}

export function stopRssPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
