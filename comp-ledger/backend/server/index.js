import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { pool } from './lib/db.js';
import authRoutes from './routes/auth.js';
import traceRoutes from './routes/trace.js';
import exportRoutes from './routes/export.js';
import multiTraceRoutes from './routes/multi-trace.js';
import tracesRoutes from './routes/traces.js';
import publisherRoutes from './routes/publishers.js';
import articleRoutes from './routes/articles.js';
import articleCheckRoutes from './routes/article-check.js';
import deepTraceRoutes from './routes/deep-trace.js';
import ingestRoutes from './routes/ingest.js';
import { startRssPoller, stopRssPoller } from './services/rss-poller.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Ensure CORS headers are set and disable HTTP/3 for SSE streams
app.use((req, res, next) => {
  const originalWrite = res.write;
  let headersSent = false;
  res.write = function (...args) {
    if (!headersSent) {
      headersSent = true;
      if (!res.headersSent) {
        const origin = req.headers.origin;
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        // Disable HTTP/3 (QUIC) for streaming responses — CloudFront drops long-lived QUIC streams
        res.setHeader('Alt-Svc', 'clear');
      }
    }
    return originalWrite.apply(this, args);
  };
  next();
});

const limiter = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

app.use(authRoutes);
app.use(traceRoutes);
app.use(exportRoutes);
app.use(multiTraceRoutes);
app.use(tracesRoutes);
app.use(publisherRoutes);
app.use(articleRoutes);
app.use(articleCheckRoutes);
app.use(deepTraceRoutes);
app.use(ingestRoutes);

app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});

const port = parseInt(process.env.PORT || '4001');
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`CoMP Ledger server running on port ${port}`);
  startRssPoller();
});

process.on('SIGTERM', async () => {
  stopRssPoller();
  await pool.end();
  server.close();
});
