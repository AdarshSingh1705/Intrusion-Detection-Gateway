// gateway/guards/rateGuard.js
// Application-layer DoS / API abuse detection via fixed-window Redis counters.
const redis = require('../config/redis');

async function evaluateRateGuard(req, tenantConfig) {
  const { tenantId, thresholds } = tenantConfig;

  try {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const key = `ratecount:${tenantId}:${req.ip}`;

    // Remove requests outside the 60-second sliding window
    await redis.zremrangebyscore(key, 0, now - windowMs);
    // Add current request timestamp
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    // Count total requests in window
    const count = await redis.zcard(key);
    await redis.expire(key, 60);

    if (count > thresholds.rateBlockMax)
      return { verdict: 'malicious', reason: 'rate_flood', action: 'block_ip' };

    if (count > thresholds.rateWarnMax)
      return { verdict: 'suspicious', reason: 'rate_abuse', action: 'throttle' };

    return { verdict: 'clean' };
  } catch (err) {
    console.error('[rateGuard] Redis unavailable, failing open:', err.message);
    return { verdict: 'clean', degraded: true };
  }
}

module.exports = evaluateRateGuard;
