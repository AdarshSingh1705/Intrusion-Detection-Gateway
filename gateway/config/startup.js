const mongoose = require('mongoose');
const redis = require('./redis');

const FALLBACKS = {
  MONGO_URI: 'mongodb://mongo:27017/gateway',
  REDIS_URL: 'redis://redis:6379',
  JWT_SECRET: 'dev-only-insecure-secret',
};

const PRODUCTION_REQUIRED = [
  'MONGO_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
];

const WEAK_JWT_SECRETS = new Set([
  'change_me',
  'change-me',
  'dev-only-insecure-secret',
  'your_strong_secret_here',
]);

const WEAK_ADMIN_PASSWORDS = new Set([
  'change-me',
  'change-me-to-a-strong-password',
  'admin',
  'password',
  'password123',
]);

function validateProductionEnvironment() {
  for (const key of PRODUCTION_REQUIRED) {
    if (!process.env[key] || !process.env[key].trim()) {
      throw new Error(
        `[startup] ${key} must be set when NODE_ENV=production`
      );
    }
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      '[startup] JWT_SECRET must be at least 32 characters in production'
    );
  }

  if (WEAK_JWT_SECRETS.has(process.env.JWT_SECRET)) {
    throw new Error(
      '[startup] JWT_SECRET contains a known insecure placeholder'
    );
  }

  if (process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error(
      '[startup] ADMIN_PASSWORD must be at least 12 characters in production'
    );
  }

  if (WEAK_ADMIN_PASSWORDS.has(process.env.ADMIN_PASSWORD)) {
    throw new Error(
      '[startup] ADMIN_PASSWORD contains a known insecure placeholder'
    );
  }

  if (process.env.ADMIN_USERNAME.length < 3) {
    throw new Error(
      '[startup] ADMIN_USERNAME must be at least 3 characters in production'
    );
  }
}

function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    validateProductionEnvironment();

    return {
      MONGO_URI: process.env.MONGO_URI,
      REDIS_URL: process.env.REDIS_URL,
      JWT_SECRET: process.env.JWT_SECRET,
    };
  }

  for (const [key, fallback] of Object.entries(FALLBACKS)) {
    if (process.env[key]) continue;

    process.env[key] = fallback;

    console.warn(
      `[startup] ${key} not set; using fallback value for local/dev execution`
    );
  }

  return {
    MONGO_URI: process.env.MONGO_URI,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  };
}

async function getHealthSnapshot() {
  const mongoState =
    mongoose.connection.readyState === 1 ? 'up' : 'connecting';

  let redisState = 'down';

  try {
    await redis.ping();
    redisState = 'up';
  } catch (err) {
    redisState = 'down';
  }

  return {
    status:
      mongoState === 'up' && redisState === 'up'
        ? 'ok'
        : 'degraded',

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