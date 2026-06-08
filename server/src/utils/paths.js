// Shared filesystem paths. Uploads live next to the SQLite DB so a single data volume
// (in Docker) persists both the database and generated images.

import path from 'node:path';

const databasePath = process.env.DATABASE_PATH || './data/app.sqlite';

export const dataDir = path.dirname(path.resolve(databasePath));
export const uploadsDir = path.join(dataDir, 'uploads');
export const cardsUploadDir = path.join(uploadsDir, 'cards');

/** Public URL path served for a card image of the given date. */
export function cardImageUrl(date) {
  return `/uploads/cards/${date}.png`;
}
