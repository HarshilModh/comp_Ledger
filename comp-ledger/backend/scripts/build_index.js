import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import pgvector from 'pgvector';

dotenv.config();

const { embedText } = await import('../server/services/embed.js');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://comp:comp_dev@localhost:5432/comp_ledger',
});

const CHUNK_SIZE = 300;

function chunkText(text, chunkSize = CHUNK_SIZE) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

async function processCorpus(dir, corpusType) {
  const files = readdirSync(dir).filter(f => f.endsWith('.txt'));
  console.log(`Processing ${corpusType}: ${files.length} files`);

  const allChunks = [];

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    const textChunks = chunkText(content);

    for (let i = 0; i < textChunks.length; i++) {
      allChunks.push({
        doc_id: file,
        chunk_idx: i,
        text: textChunks[i],
        vector: null,
      });
    }
  }

  console.log(`${corpusType}: ${allChunks.length} chunks to embed`);

  const BATCH_SIZE = 5;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const vectors = await Promise.all(batch.map(c => embedText(c.text)));
    for (let j = 0; j < batch.length; j++) {
      batch[j].vector = vectors[j];
    }
    process.stdout.write(`\r  ${corpusType}: embedded ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length} chunks`);
  }
  console.log('');

  const DB_BATCH = 100;
  for (let i = 0; i < allChunks.length; i += DB_BATCH) {
    const batch = allChunks.slice(i, i + DB_BATCH);
    const values = [];
    const params = [];

    for (let j = 0; j < batch.length; j++) {
      const base = j * 5;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::vector)`);
      params.push(batch[j].doc_id, batch[j].chunk_idx, corpusType, batch[j].text, pgvector.toSql(batch[j].vector));
    }

    await pool.query(
      `INSERT INTO embeddings (doc_id, chunk_idx, corpus_type, text, embedding)
       VALUES ${values.join(', ')}
       ON CONFLICT (doc_id, chunk_idx, corpus_type)
       DO UPDATE SET text = EXCLUDED.text, embedding = EXCLUDED.embedding`,
      params
    );
  }

  console.log(`  ${corpusType}: ${allChunks.length} chunks written to database`);
  return allChunks.length;
}

console.log('Building embedding index into PostgreSQL...');
console.log('');

const publisherCount = await processCorpus('./data/publisher', 'publisher');
const referenceCount = await processCorpus('./data/reference', 'reference');

console.log('');
console.log('Index build complete:');
console.log(`  Publisher: ${publisherCount} chunks`);
console.log(`  Reference: ${referenceCount} chunks`);

await pool.end();
