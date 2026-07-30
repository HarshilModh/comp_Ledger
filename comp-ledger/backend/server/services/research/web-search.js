import { gdeltLimiter } from './rate-limiter.js';
import { curlGetJson } from './http.js';

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

export async function search(claim, { domain } = {}) {
  if (!domain) return [];

  try {
    await gdeltLimiter.acquire();

    const words = claim.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5)
      .join(' ');

    if (!words) return [];

    const params = new URLSearchParams({
      query: `${words} domain:${domain}`,
      mode: 'artlist',
      maxrecords: '5',
      format: 'json',
    });

    const data = await curlGetJson(`${GDELT_DOC_URL}?${params}`, 6000);
    if (!data) return [];

    const articles = data.articles || [];

    return articles.map(a => {
      const articleDomain = a.domain || (() => {
        try { return new URL(a.url).hostname.replace(/^www\./, ''); }
        catch { return ''; }
      })();

      return {
        title: a.title || '',
        url: a.url || '',
        domain: articleDomain,
        publishedAt: a.seendate || '',
        snippet: (a.title || '').slice(0, 300),
        sourceType: 'WEB_SEARCH',
        isPublisherDomain: articleDomain.includes(domain),
      };
    });
  } catch (err) {
    console.error('[WEB_SEARCH] failed:', err.message);
    return [];
  }
}
