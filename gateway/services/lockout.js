const redis = require('../config/redis');

const LOCK_TTL = 900; // 15 minutes

async function lockAccount(tenantId, username) {
  await redis.set(`locked:${tenantId}:${username}`, '1', 'EX', LOCK_TTL);
}

async function isLocked(tenantId, username) {
  return await redis.exists(`locked:${tenantId}:${username}`);
}

module.exports = { lockAccount, isLocked };
