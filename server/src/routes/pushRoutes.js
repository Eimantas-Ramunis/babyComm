// Push registration endpoint. Stubbed in Phase 1 (real web-push lands in Phase 4).

import { Router } from 'express';

const router = Router();

// POST /api/push/register — accepts a subscription but does not store it yet.
router.post('/register', (req, res) => {
  res.json({ ok: true, message: 'Push registration not implemented yet' });
});

export default router;
