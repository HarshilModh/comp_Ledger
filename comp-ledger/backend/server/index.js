import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pool } from './lib/db.js';
import traceRoutes from './routes/trace.js';
import exportRoutes from './routes/export.js';
import multiTraceRoutes from './routes/multi-trace.js';
import tracesRoutes from './routes/traces.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });

await fastify.register(traceRoutes);
await fastify.register(exportRoutes);
await fastify.register(multiTraceRoutes);
await fastify.register(tracesRoutes);

fastify.get('/api/health', async () => {
  await pool.query('SELECT 1');
  return { status: 'ok' };
});

fastify.addHook('onClose', async () => {
  await pool.end();
});

const port = parseInt(process.env.PORT || '3001');
await fastify.listen({ port, host: '0.0.0.0' });
console.log(`CoMP Ledger server running on port ${port}`);
