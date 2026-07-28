import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFileSync, existsSync } from 'fs';
import { loadIndex } from './services/retrieve.js';
import traceRoutes from './routes/trace.js';
import exportRoutes from './routes/export.js';
import multiTraceRoutes from './routes/multi-trace.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });

const INDEX_PATH = './data/index.json';
if (existsSync(INDEX_PATH)) {
  console.log('Loading embedding index...');
  const indexData = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));
  loadIndex(indexData);
  console.log(`Index loaded: ${indexData.publisher.chunks.length} publisher chunks, ${indexData.reference.chunks.length} reference chunks`);
} else {
  console.warn('WARNING: No index.json found. Run "npm run build-index" first.');
}

await fastify.register(traceRoutes);
await fastify.register(exportRoutes);
await fastify.register(multiTraceRoutes);

fastify.get('/api/health', async () => ({ status: 'ok' }));

const port = parseInt(process.env.PORT || '3001');
await fastify.listen({ port, host: '0.0.0.0' });
console.log(`CoMP Ledger server running on port ${port}`);
