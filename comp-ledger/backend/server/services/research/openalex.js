import { curlGetJson } from './http.js';

const API_URL = 'https://api.openalex.org/works';

export async function search(claim) {
  try {
    const query = claim.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 6)
      .join('+');

    if (!query) return [];

    const url = `${API_URL}?search=${encodeURIComponent(query)}&per_page=4&mailto=comp-ledger@example.com`;
    const data = await curlGetJson(url, 10000);
    if (!data || !data.results) return [];

    return data.results.map(r => ({
      title: r.title || '',
      url: r.doi || r.id || '',
      domain: 'openalex.org',
      publishedAt: r.publication_date || '',
      snippet: r.title || '',
      sourceType: 'OPENALEX',
      isPublisherDomain: false,
    }));
  } catch (err) {
    console.error('[OPENALEX] failed:', err.message);
    return [];
  }
}
