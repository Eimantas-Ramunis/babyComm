// Express entry point for the Baby Growth PWA backend (Phase 1).

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from the repo root (.env) regardless of where the process is started.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { runMigrations } = await import('./db/migrations.js');
const { default: publicRoutes } = await import('./routes/publicRoutes.js');
const { default: pushRoutes } = await import('./routes/pushRoutes.js');
const { default: adminRoutes } = await import('./routes/adminRoutes.js');

const PORT = process.env.PORT || 3000;

runMigrations();

const app = express();
app.use(cors()); // permissive for local dev; tighten in production deployment
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', publicRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin', adminRoutes);

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
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Baby Growth PWA server listening on http://localhost:${PORT}`);
});
