export function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) dot += vecA[i] * vecB[i];
  return dot;
}

export function searchIndex(queryVec, chunks, topK = 5) {
  const scored = chunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryVec, chunk.vector),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
