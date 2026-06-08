// Public push endpoints. POST /register is intentionally public (per spec §7) so mom's
// device can subscribe from the Home page without the admin password.

import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { getVapidPublicKey, registerDevice } from '../services/pushService.js';

const router = Router();

// Throttle the public, unauthenticated registration endpoint to limit abusive writes.
const registerLimiter = rateLimit({ windowMs: 60_000, max: 20 });

// GET /api/push/vapid-public-key — the frontend needs this to create a PushManager subscription.
router.get('/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) return res.status(503).json({ error: 'Push not configured.' });
  res.json({ publicKey });
});

// POST /api/push/register — store/refresh a device subscription (deduped by endpoint).
router.post('/register', registerLimiter, (req, res) => {
  const { subscription, deviceName, userAgent } = req.body ?? {};
  if (!subscription || typeof subscription.endpoint !== 'string') {
    return res.status(400).json({ error: 'A valid push subscription is required.' });
  }
  // Reject implausibly large endpoints (real ones are a few hundred chars).
  if (subscription.endpoint.length > 2048) {
    return res.status(400).json({ error: 'Subscription endpoint is too long.' });
  }
  const device = registerDevice({
    subscription,
    deviceName,
    userAgent: userAgent || req.get('user-agent') || null,
  });
  res.status(201).json({ ok: true, deviceId: device.id });
});

export default router;
