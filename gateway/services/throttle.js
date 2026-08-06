const redis = require('../config/redis');

const BLOCK_TTL = 900; // 15 minutes

async function isBlocked(tenantId, ip) {
  return Boolean(await redis.exists(`blocklist:${tenantId}:${ip}`));
}

async function blockIp(tenantId, ip) {
  await redis.set(`blocklist:${tenantId}:${ip}`, 'rate_flood', 'EX', BLOCK_TTL);
}

async function unblockIp(tenantId, ip) {
  await redis.del(`blocklist:${tenantId}:${ip}`);
}

async function getBlockedIps(tenantId) {
  const keys = await redis.keys(`blocklist:${tenantId}:*`);
  const result = [];
  for (const key of keys) {
    const ip = key.replace(`blocklist:${tenantId}:`, '');
    const reason = await redis.get(key);
    const ttl = await redis.ttl(key);
    result.push({ ip, reason, ttl });
  }
  return result;
}

module.exports = { blockIp, unblockIp, isBlocked, getBlockedIps };
