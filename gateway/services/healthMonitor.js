const redis = require('../config/redis');

const ORIGIN_URL = process.env.DEMO_SITE_ORIGIN_URL || 'http://demo-site:4000';
const PING_INTERVAL = 10000;   // 10s
const COOLDOWN = 30000;        // 30s before half-open
const WINDOW_SIZE = 5;         // last N pings tracked (low for easy testing)
const FAIL_THRESHOLD = 0.5;    // 50% failure rate -> open

async function getCircuitState(tenantId) {
  return (await redis.get(`circuit:${tenantId}:state`)) || 'closed';
}

async function setCircuitState(tenantId, state) {
  await redis.set(`circuit:${tenantId}:state`, state);
}

async function recordResult(tenantId, failed) {
  const key = `circuit:${tenantId}:results`;
  await redis.lpush(key, failed ? '1' : '0');
  await redis.ltrim(key, 0, WINDOW_SIZE - 1);
}

async function shouldOpen(tenantId) {
  const results = await redis.lrange(`circuit:${tenantId}:results`, 0, -1);
  if (results.length < WINDOW_SIZE) return false;
  const failures = results.filter((r) => r === '1').length;
  return failures / results.length >= FAIL_THRESHOLD;
}

async function pingOrigin(tenantId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(ORIGIN_URL, { signal: controller.signal });
    clearTimeout(timeout);
    const failed = !res.ok;
    await recordResult(tenantId, failed);
  } catch {
    await recordResult(tenantId, true);
  }

  const state = await getCircuitState(tenantId);

  if (state === 'closed' && (await shouldOpen(tenantId))) {
    await setCircuitState(tenantId, 'open');
    await redis.set(`circuit:${tenantId}:openedAt`, Date.now());
    console.warn(`[circuit] ${tenantId} -> OPEN`);
  }

  if (state === 'open') {
    const openedAt = Number(await redis.get(`circuit:${tenantId}:openedAt`)) || 0;
    if (Date.now() - openedAt >= COOLDOWN) {
      await setCircuitState(tenantId, 'half-open');
      console.warn(`[circuit] ${tenantId} -> HALF-OPEN`);
    }
  }
}

// Start polling for the default tenant
setInterval(() => pingOrigin('default'), PING_INTERVAL);

module.exports = { getCircuitState, setCircuitState, recordResult };
