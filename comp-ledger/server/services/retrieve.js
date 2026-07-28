import { searchIndex } from '../lib/cosine.js';

let index = null;

export function loadIndex(indexData) {
  index = indexData;
}

export function retrieveCandidates(queryVec, topK = 5) {
  if (!index) throw new Error('Index not loaded');

  const publisherHits = searchIndex(queryVec, index.publisher.chunks, topK);
  const referenceHits = searchIndex(queryVec, index.reference.chunks, topK);

  return { publisherHits, referenceHits };
}
