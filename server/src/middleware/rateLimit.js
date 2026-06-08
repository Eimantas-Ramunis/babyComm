// Tiny in-memory fixed-window rate limiter (no dependency). Sufficient for a single-family,
// single-process app — lightly throttles the expensive AI generation endpoints (spec §15).

export function rateLimit({ windowMs = 60_000, max = 10 } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = req.ip || 'global';

    // Opportunistically drop expired entries so the map can't grow unbounded from many IPs.
    if (hits.size > 1000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }

    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests, please slow down.' });
    }
    return next();
  };
}
