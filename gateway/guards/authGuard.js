// gateway/guards/authGuard.js
// Detects brute-force and credential stuffing BEFORE the login handler runs.
// Acts as a pre-check gate — blocks accounts already over threshold from prior requests.
// Reference: LLD S1.1
const redis = require('../config/redis');

async function evaluateAuthGuard(req, tenantConfig) {
  const fullPath = req.baseUrl + req.path;
  if (fullPath !== '/auth/login') return { verdict: 'clean' };

  const { username } = req.body || {};
  const ip = req.ip;
  const { tenantId, thresholds } = tenantConfig;
  if (!username) return { verdict: 'clean' };

  // Pre-check: block if this account is already over the threshold from prior requests
  const failCount = Number(await redis.get(`failedlogin:${tenantId}:${username}`)) || 0;
  if (failCount >= thresholds.authFailMax) {
    return { verdict: 'malicious', reason: 'brute_force', action: 'lock_account' };
  }

  // Credential stuffing: many distinct usernames tried from same IP
  const distinctUsernames = await redis.scard(`failedlogin_ip:${tenantId}:${ip}`);
  const totalFromIp = Number(await redis.get(`failedlogin_ip_total:${tenantId}:${ip}`)) || 0;
  if (distinctUsernames >= 5 && totalFromIp >= 20) {
    return { verdict: 'malicious', reason: 'credential_stuffing', action: 'block_ip' };
  }

  return { verdict: 'clean' };
}

module.exports = evaluateAuthGuard;
