const createRateLimiter = ({ windowMs, max, keyFn, message }) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : (req.ip || 'unknown');
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({ message: message || 'Too many requests' });
    }

    entry.count += 1;
    return next();
  };
};

module.exports = {
  createRateLimiter,
};
