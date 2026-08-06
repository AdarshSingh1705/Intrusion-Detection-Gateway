// gateway/config/redis.js
// Redis client setup. Backs rate counters, blocklists, revoked tokens.
// Reference: LLD S4 (Redis keys)
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  enableOfflineQueue: true,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 200, 3000);
  },
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error', err)); // fail-open on error, see HLD S7

module.exports = redis;
