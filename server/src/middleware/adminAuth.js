// Simple admin auth for MVP: a shared password sent via the x-admin-password header.
// No sessions yet (per spec). Compared in constant time to avoid timing leaks.

import crypto from 'node:crypto';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });
  }

  const provided = req.get('x-admin-password');
  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}
