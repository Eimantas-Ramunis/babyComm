// Builds the Express app (routes, middleware, static client). Kept separate from index.js so
// integration tests can import the app without starting the HTTP listener or the scheduler.
//
// NOTE: importing this module opens the database (via the route imports), so callers that need
// a custom DATABASE_PATH must set it before importing this file.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import { runMigrations } from './db/migrations.js';
import { ensureVapidKeys } from './services/pushService.js';
import { uploadsDir } from './utils/paths.js';
import { logger } from './utils/logger.js';
import publicRoutes from './routes/publicRoutes.js';
import pushRoutes from './routes/pushRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  runMigrations();
  ensureVapidKeys();

  const app = express();
  app.set('trust proxy', 1); // behind Caddy/reverse proxy in production

  // In production the client is served same-origin, so restrict cross-origin access to the
  // configured app URL (if any). In dev, allow the Vite origin(s) freely.
  if (process.env.NODE_ENV === 'production') {
    app.use(cors({ origin: process.env.APP_BASE_URL || false }));
  } else {
    app.use(cors());
  }
  app.use(express.json({ limit: '16kb' })); // cap request bodies (push subscriptions are small)

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', publicRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/admin', adminRoutes);

  // Serve generated card images (persisted on the data volume in Docker).
  app.use('/uploads', express.static(uploadsDir));

  // In production, serve the built client (client/dist) with an SPA fallback.
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // 404 for unmatched API routes.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Centralized JSON error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
