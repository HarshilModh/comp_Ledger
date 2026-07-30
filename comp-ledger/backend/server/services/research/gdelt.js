import { gdeltLimiter } from './rate-limiter.js';
import { curlGetJson } from './http.js';

const API_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'that', 'this', 'these', 'those', 'and', 'but', 'or', 'nor',
  'not', 'so', 'very', 'just', 'about', 'also', 'more', 'most', 'other',
  'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'each',
  'every', 'both', 'few', 'all', 'any', 'who', 'whom', 'which', 'what',
  'when', 'where', 'why', 'how', 'if', 'because', 'while', 'although',
  'it', 'its', 'he', 'she', 'they', 'them', 'his', 'her', 'their',
  'him', 'we', 'us', 'our', 'my', 'your', 'i', 'me', 'said', 'according',
]);

function extractKeywords(claim) {
  const words = claim.replace(/[^a-zA-Z0-9\s-]/g, '').split(/\s+/);

  const properNouns = [];
  const regular = [];

  for (const word of words) {
    if (word.length < 3) continue;
    const lower = word.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;

    if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      properNouns.push(word);
    } else {
      regular.push(word);
    }
  }

  const combined = [...properNouns, ...regular];
  return combined.slice(0, 6);
}

export async function search(claim, { domain, altDomains = [] } = {}) {
  try {
    await gdeltLimiter.acquire();

    const keywords = extractKeywords(claim);
    if (keywords.length < 2) return [];

    const queryStr = keywords.join(' ');

    const params = new URLSearchParams({
      query: queryStr,
      mode: 'artlist',
      maxrecords: '10',
      format: 'json',
    });

    const data = await curlGetJson(`${API_URL}?${params}`, 6000);
    if (!data) return [];

    const articles = data.articles || [];

    const allDomains = new Set([domain, ...altDomains].filter(Boolean).map(d => d.toLowerCase()));

    return articles.map(a => ({
      title: a.title || '',
      url: a.url || '',
      domain: a.domain || new URL(a.url).hostname.replace(/^www\./, ''),
      publishedAt: a.seendate || '',
      snippet: (a.title || '').slice(0, 300),
      sourceType: 'GDELT',
      isPublisherDomain: allDomains.has((a.domain || '').toLowerCase()),
    }));
  } catch (err) {
    console.error('[GDELT] search failed:', err.message);
    return [];
  }
}
