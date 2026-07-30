import * as wikipedia from './wikipedia.js';
import * as gdelt from './gdelt.js';
import * as googleCse from './google-cse.js';
import * as webSearch from './web-search.js';
import * as openalex from './openalex.js';
import * as wayback from './wayback.js';
import { judgeEvidence } from './judge.js';

export async function deepResearch(claim, publisher, { onSource } = {}) {
  const { domain, alt_domains: altDomains = [] } = publisher;
  const allDomains = new Set([domain, ...altDomains].map(d => d.toLowerCase()));

  const [wikiResults, googleResults, alexResults] = await Promise.all([
    wikipedia.search(claim),
    googleCse.search(claim, { domain }).catch(() => []),
    openalex.search(claim).catch(() => []),
  ]);

  let allSources = [...wikiResults, ...googleResults, ...alexResults];

  if (onSource) {
    for (const source of allSources) {
      onSource(source);
    }
  }

  const finalPublisherHits = allSources.filter(s =>
    allDomains.has(s.domain?.toLowerCase()) || s.isPublisherDomain
  );

  const urlsToVerify = allSources
    .map(s => s.url)
    .filter(Boolean)
    .slice(0, 5);

  let waybackResults = [];
  if (urlsToVerify.length > 0) {
    waybackResults = await wayback.verifyUrls(urlsToVerify);
    if (onSource) {
      for (const w of waybackResults) {
        onSource({ ...w, title: 'Wayback Machine confirmation', snippet: `First archived: ${w.archivedAt}` });
      }
    }
  }

  const judge = await judgeEvidence(claim, publisher, allSources, waybackResults);

  return {
    claim_text: claim,
    publisher_domain: domain,
    sources: allSources,
    publisher_sources: finalPublisherHits,
    temporal_evidence: waybackResults,
    judge,
    source_count: allSources.length,
    publisher_source_count: finalPublisherHits.length,
  };
}
