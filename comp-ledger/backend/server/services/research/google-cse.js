import { googleLimiter } from './rate-limiter.js';
import { curlGetJson } from './http.js';

const API_URL = 'https://www.googleapis.com/customsearch/v1';

export async function search(claim, { domain } = {}) {
  const apiKey = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) return [];

  try {
    await googleLimiter.acquire();

    const params = new URLSearchParams({
      key: apiKey,
      cx,
      q: claim.slice(0, 200),
      num: '5',
    });

    const data = await curlGetJson(`${API_URL}?${params}`, 10000);
    if (!data) return [];

    if (data.error) {
      console.error('[GOOGLE_CSE] API error:', data.error.message);
      return [];
    }

    const items = data.items || [];

    return items.map(item => {
      const itemDomain = (() => {
        try { return new URL(item.link).hostname.replace(/^www\./, ''); }
        catch { return ''; }
      })();

      const publishedAt = item.pagemap?.metatags?.[0]?.['article:published_time'] ||
                          item.pagemap?.metatags?.[0]?.['og:updated_time'] || '';

      return {
        title: item.title || '',
        url: item.link || '',
        domain: itemDomain,
        publishedAt,
        snippet: item.snippet || '',
        sourceType: 'GOOGLE_CSE',
        isPublisherDomain: domain ? itemDomain.includes(domain) : false,
      };
    });
  } catch (err) {
    console.error('[GOOGLE_CSE] failed:', err.message);
    return [];
  }
}
