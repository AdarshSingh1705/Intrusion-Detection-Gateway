// gateway/guards/rateGuard.js
// Application-layer DoS / API abuse detection via fixed-window Redis counters.
// Reference: LLD S1.2
// Known limitation: fixed windows allow ~2x burst at window boundaries.
// Sliding window is a documented future refinement, not required for v1.

const redis = require('../config/redis');

async function evaluateRateGuard(req, tenantConfig) {
  const { tenantId, thresholds } = tenantConfig;
  const window = Math.floor(Date.now() / 1000 / 60);
  const key = `ratecount:${tenantId}:${req.ip}:${window}`;

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);

  if (count > thresholds.rateBlockMax)
    return { verdict: 'malicious', reason: 'rate_flood', action: 'block_ip' };

  if (count > thresholds.rateWarnMax)
    return { verdict: 'suspicious', reason: 'rate_abuse', action: 'throttle' };

  return { verdict: 'clean' };
}

module.exports = evaluateRateGuard;
