import { query } from '../lib/db.js';
import pgvector from 'pgvector';

export async function retrieveCandidates(queryVec, topK = 5, publisherId = null) {
  const vecString = pgvector.toSql(queryVec);

  const publisherResult = publisherId
    ? await query(
        `SELECT doc_id, chunk_idx, text, 1 - (embedding <=> $1::vector) AS similarity
         FROM embeddings
         WHERE corpus_type = 'publisher' AND publisher_id = $3
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vecString, topK, publisherId]
      )
    : await query(
        `SELECT doc_id, chunk_idx, text, 1 - (embedding <=> $1::vector) AS similarity
         FROM embeddings
         WHERE corpus_type = 'publisher'
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vecString, topK]
      );

  const referenceResult = await query(
    `SELECT doc_id, chunk_idx, text, 1 - (embedding <=> $1::vector) AS similarity
     FROM embeddings
     WHERE corpus_type = 'reference'
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vecString, topK]
  );

  return {
    publisherHits: publisherResult.rows,
    referenceHits: referenceResult.rows,
  };
}
