const BASE_URL = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'CoMP-Ledger/1.0 (fact-checking tool)';

export async function search(claim) {
  try {
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: claim.slice(0, 300),
      srlimit: '3',
      format: 'json',
    });

    const searchRes = await fetch(`${BASE_URL}?${searchParams}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (!searchRes.ok) return [];

    const searchData = await searchRes.json();
    const pages = searchData.query?.search || [];

    if (pages.length === 0) return [];

    const titles = pages.map(p => p.title).join('|');
    const extractParams = new URLSearchParams({
      action: 'query',
      titles,
      prop: 'extracts|info',
      exintro: 'true',
      explaintext: 'true',
      exsentences: '3',
      inprop: 'url',
      format: 'json',
    });

    const extractRes = await fetch(`${BASE_URL}?${extractParams}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (!extractRes.ok) return [];

    const extractData = await extractRes.json();
    const pageResults = Object.values(extractData.query?.pages || {});

    return pageResults
      .filter(p => p.pageid && p.extract)
      .map(p => ({
        title: p.title,
        url: p.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
        domain: 'en.wikipedia.org',
        publishedAt: '',
        snippet: p.extract.slice(0, 400),
        sourceType: 'WIKIPEDIA',
      }));
  } catch {
    return [];
  }
}
