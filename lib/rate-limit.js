const buckets = globalThis.__UMERA_RATE_LIMITS__ || new Map();
globalThis.__UMERA_RATE_LIMITS__ = buckets;

function clientKey(req, scope) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || 'unknown';
  return `${scope}:${ip}`;
}

export function enforceRateLimit(req, scope, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const key = clientKey(req, scope);
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > limit) {
    const error = new Error('RATE_LIMIT');
    error.retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw error;
  }
}

export function setRateLimitResponse(res, error) {
  res.setHeader('Retry-After', String(error.retryAfter || 60));
  return res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.' });
}
