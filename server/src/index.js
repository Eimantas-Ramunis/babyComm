// Express entry point for the Baby Growth PWA backend.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from the repo root (.env) regardless of where the process is started.
// Must happen before importing modules that read env at load time (database, paths).
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { createApp } = await import('./app.js');
const { startScheduler } = await import('./services/schedulerService.js');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Baby Growth PWA server listening on http://localhost:${PORT}`);
  startScheduler();
});
