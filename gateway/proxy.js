const httpProxy = require('http-proxy');
const express = require('express');
const router = express.Router();
const proxy = httpProxy.createProxyServer({});
const runGuards = require('./core/runGuards');
const defaultTenant = require('./config/defaultTenant');
const { isBlocked, blockIp } = require('./services/throttle');

const ORIGIN_URL = process.env.DEMO_SITE_ORIGIN_URL || 'http://demo-site:4000';

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (!res.headersSent) res.status(502).send('Origin unreachable');
});

router.use(async (req, res) => {
  const { tenantId } = defaultTenant;

  // Fast-path: reject already-blocked IPs before running guards
  if (await isBlocked(tenantId, req.ip)) {
    return res.status(403).json({ error: 'blocked', reason: 'ip_blocklist' });
  }

  const verdict = await runGuards(req, defaultTenant);

  if (verdict.finalVerdict === 'allow') {
    return proxy.web(req, res, { target: ORIGIN_URL });
  }

  // Persist block to Redis for IPs that should be banned (rate flood or credential stuffing)
  const shouldBlockIp = verdict.finalVerdict === 'block' &&
    (verdict.triggeredBy === 'rate_flood' || verdict.triggeredBy === 'credential_stuffing');
  if (shouldBlockIp) {
    await blockIp(tenantId, req.ip);
  }

  res.status(verdict.finalVerdict === 'block' ? 403 : 429).json({ verdict });
});

module.exports = router;
