// gateway/guards/authGuard.js
// Detects brute-force and credential stuffing BEFORE the login handler runs.
const redis = require('../config/redis');

async function evaluateAuthGuard(req, tenantConfig) {
  const fullPath = req.baseUrl + req.path;
  if (fullPath !== '/auth/login') return { verdict: 'clean' };

  const { username } = req.body || {};
  const ip = req.ip;
  const { tenantId, thresholds } = tenantConfig;
  if (!username) return { verdict: 'clean' };

  try {
    const failCount = Number(await redis.get(`failedlogin:${tenantId}:${username}`)) || 0;
    if (failCount >= thresholds.authFailMax) {
      return { verdict: 'malicious', reason: 'brute_force', action: 'lock_account' };
    }

    const distinctUsernames = await redis.scard(`failedlogin_ip:${tenantId}:${ip}`);
    const totalFromIp = Number(await redis.get(`failedlogin_ip_total:${tenantId}:${ip}`)) || 0;
    if (distinctUsernames >= 5 && totalFromIp >= 20) {
      return { verdict: 'malicious', reason: 'credential_stuffing', action: 'block_ip' };
    }

    return { verdict: 'clean' };
  } catch (err) {
    console.error('[authGuard] Redis unavailable, failing open:', err.message);
    return { verdict: 'clean', degraded: true };
  }
}

module.exports = evaluateAuthGuard;
