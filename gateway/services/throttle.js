const redis = require('../config/redis');

const BLOCK_TTL = 900; // 15 minutes

async function blockIp(tenantId, ip) {
  await redis.set(`blocklist:${tenantId}:${ip}`, 'rate_flood', 'EX', BLOCK_TTL);
}

async function unblockIp(tenantId, ip) {
  await redis.del(`blocklist:${tenantId}:${ip}`);
}

async function isBlocked(tenantId, ip) {
  return await redis.exists(`blocklist:${tenantId}:${ip}`);
}

module.exports = { blockIp, unblockIp, isBlocked };
