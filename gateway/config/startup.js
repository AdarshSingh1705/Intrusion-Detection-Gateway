const mongoose = require('mongoose');
const redis = require('./redis');

const FALLBACKS = {
  MONGO_URI: 'mongodb://mongo:27017/gateway',
  REDIS_URL: 'redis://redis:6379',
  JWT_SECRET: 'dev-secret-change-me',
};

function validateEnvironment() {
  for (const [key, fallback] of Object.entries(FALLBACKS)) {
    if (process.env[key]) continue;

    // JWT_SECRET is a hard requirement in production — fail fast instead of
    // silently signing tokens with a publicly-known fallback secret.
    if (key === 'JWT_SECRET' && process.env.NODE_ENV === 'production') {
      throw new Error('[startup] JWT_SECRET must be set when NODE_ENV=production');
    }

    process.env[key] = fallback;
    console.warn(`[startup] ${key} not set; using fallback value for local/dev execution`);
  }

  return {
    MONGO_URI: process.env.MONGO_URI,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  };
}

async function getHealthSnapshot() {
  const mongoState = mongoose.connection.readyState === 1 ? 'up' : 'connecting';

  let redisState = 'down';
  try {
    await redis.ping();
    redisState = 'up';
  } catch (err) {
    redisState = 'down';
  }

  return {
    status: mongoState === 'up' && redisState === 'up' ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    services: {
      mongo: mongoState,
      redis: redisState,
    },
  };
}

module.exports = {
  validateEnvironment,
  getHealthSnapshot,
};
