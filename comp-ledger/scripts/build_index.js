import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Dynamic import to reuse the embed service
const { embedText } = await import('../server/services/embed.js');

const CHUNK_SIZE = 300; // words

function chunkText(text, chunkSize = CHUNK_SIZE) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

async function processCorpus(dir, label) {
  const files = readdirSync(dir).filter(f => f.endsWith('.txt'));
  console.log(`Processing ${label}: ${files.length} files`);

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

  console.log(`${label}: ${allChunks.length} chunks to embed`);

  const BATCH_SIZE = 5;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const vectors = await Promise.all(batch.map(c => embedText(c.text)));
    for (let j = 0; j < batch.length; j++) {
      batch[j].vector = vectors[j];
    }
    process.stdout.write(`\r  ${label}: embedded ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length} chunks`);
  }
  console.log('');

  return { chunks: allChunks };
}

console.log('Building embedding index...');
console.log('');

const publisher = await processCorpus('./data/publisher', 'publisher');
const reference = await processCorpus('./data/reference', 'reference');

const index = {
  model: process.env.EMBED_MODEL_ID || 'amazon.titan-embed-text-v2:0',
  dimensions: 512,
  created_at: new Date().toISOString(),
  publisher,
  reference,
};

writeFileSync('./data/index.json', JSON.stringify(index));
console.log('');
console.log(`Index written to ./data/index.json`);
console.log(`  Publisher: ${publisher.chunks.length} chunks`);
console.log(`  Reference: ${reference.chunks.length} chunks`);
console.log(`  File size: ${(JSON.stringify(index).length / 1024 / 1024).toFixed(1)} MB`);
