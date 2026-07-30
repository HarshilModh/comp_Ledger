import { curlGetJson } from './http.js';

const CDX_URL = 'https://web.archive.org/cdx/search/cdx';

export async function verifyUrls(urls) {
  const results = [];

  for (const url of urls.slice(0, 5)) {
    try {
      const params = new URLSearchParams({
        url,
        output: 'json',
        fl: 'timestamp,original,statuscode',
        limit: '1',
        sort: 'asc',
      });

      const data = await curlGetJson(`${CDX_URL}?${params}`, 8000);
      if (!data || data.length < 2) continue;

      const [, row] = data;
      const [timestamp, original, statuscode] = row;

      if (statuscode !== '200') continue;

      const year = timestamp.slice(0, 4);
      const month = timestamp.slice(4, 6);
      const day = timestamp.slice(6, 8);
      const archivedAt = `${year}-${month}-${day}`;

      results.push({
        url: original,
        archivedAt,
        waybackUrl: `https://web.archive.org/web/${timestamp}/${original}`,
        sourceType: 'WAYBACK',
      });
    } catch {
      continue;
    }
  }

  return results;
}
