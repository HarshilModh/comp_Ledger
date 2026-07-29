import { embedText } from './embed.js';
import { query } from '../lib/db.js';
import pgvector from 'pgvector';

const CHUNK_SIZE = 300;

function chunkText(text, chunkSize = CHUNK_SIZE) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

export async function ingestArticle(article, publisherId) {
  const chunks = chunkText(article.body_text);

  const BATCH_SIZE = 5;
  const vectors = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchVectors = await Promise.all(batch.map(embedText));
    vectors.push(...batchVectors);
  }

  const DB_BATCH = 100;
  for (let i = 0; i < chunks.length; i += DB_BATCH) {
    const batch = chunks.slice(i, i + DB_BATCH);
    const values = [];
    const params = [];

    for (let j = 0; j < batch.length; j++) {
      const base = j * 6;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::vector, $${base + 6})`);
      params.push(
        article.slug,
        i + j,
        'publisher',
        batch[j],
        pgvector.toSql(vectors[i + j]),
        publisherId
      );
    }

    await query(
      `INSERT INTO embeddings (doc_id, chunk_idx, corpus_type, text, embedding, publisher_id)
       VALUES ${values.join(', ')}
       ON CONFLICT (doc_id, chunk_idx, corpus_type)
       DO UPDATE SET text = EXCLUDED.text, embedding = EXCLUDED.embedding, publisher_id = EXCLUDED.publisher_id`,
      params
    );
  }

  return { chunks_count: chunks.length };
}

export async function removeArticleEmbeddings(slug, publisherId) {
  await query(
    'DELETE FROM embeddings WHERE doc_id = $1 AND publisher_id = $2',
    [slug, publisherId]
  );
}
