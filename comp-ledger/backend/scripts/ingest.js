#!/usr/bin/env node
/**
 * Ingests real articles from URLs into the publisher/reference corpus.
 *
 * Usage:
 *   node scripts/ingest.js sources.json
 *
 * sources.json format:
 * {
 *   "publisher": [
 *     { "url": "https://...", "slug": "propublica-2023-04-clarence-thomas" }
 *   ],
 *   "reference": [
 *     { "url": "https://...", "slug": "nyt-2023-04-thomas-gifts" }
 *   ]
 * }
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchArticle(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function extractText(html, url) {
  const { document } = parseHTML(html);
  const reader = new Readability(document, { charThreshold: 100 });
  const article = reader.parse();
  if (!article || !article.textContent) {
    throw new Error(`Readability failed to extract text from ${url}`);
  }
  // Clean up: collapse whitespace, trim lines
  const text = article.textContent
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n');

  return {
    title: article.title || '',
    text,
    byline: article.byline || '',
  };
}

async function processSource(entry, corpusDir) {
  const { url, slug } = entry;
  console.log(`  Fetching: ${url}`);
  try {
    const html = await fetchArticle(url);
    const { title, text, byline } = extractText(html, url);

    const header = [
      title.toUpperCase(),
      byline ? `By ${byline}` : '',
      `Source: ${url}`,
      '',
      '---',
      '',
    ].filter(l => l !== '').join('\n');

    const content = header + text;
    const filename = `${slug}.txt`;
    const filepath = join(corpusDir, filename);
    writeFileSync(filepath, content, 'utf-8');
    console.log(`  ✓ Saved: ${filename} (${text.length} chars)`);
    return { slug, success: true, chars: text.length };
  } catch (err) {
    console.error(`  ✗ Failed: ${slug} — ${err.message}`);
    return { slug, success: false, error: err.message };
  }
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error('Usage: node scripts/ingest.js <sources.json>');
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const publisherDir = './data/publisher';
  const referenceDir = './data/reference';

  mkdirSync(publisherDir, { recursive: true });
  mkdirSync(referenceDir, { recursive: true });

  const results = { publisher: [], reference: [] };

  if (config.publisher?.length) {
    console.log(`\nIngesting ${config.publisher.length} publisher articles...`);
    for (const entry of config.publisher) {
      const r = await processSource(entry, publisherDir);
      results.publisher.push(r);
    }
  }

  if (config.reference?.length) {
    console.log(`\nIngesting ${config.reference.length} reference articles...`);
    for (const entry of config.reference) {
      const r = await processSource(entry, referenceDir);
      results.reference.push(r);
    }
  }

  const pubOk = results.publisher.filter(r => r.success).length;
  const refOk = results.reference.filter(r => r.success).length;

  console.log(`\n--- Summary ---`);
  console.log(`Publisher: ${pubOk}/${results.publisher.length} ingested`);
  console.log(`Reference: ${refOk}/${results.reference.length} ingested`);
  console.log(`\nNext steps:`);
  console.log(`  1. Remove old fabricated data if needed`);
  console.log(`  2. Run: npm run build-index`);
  console.log(`  3. Start the server: npm run dev`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
