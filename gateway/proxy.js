const httpProxy = require('http-proxy');
const express = require('express');
const router = express.Router();
const proxy = httpProxy.createProxyServer({});
const runGuards = require('./core/runGuards');
const { isBlocked, blockIp } = require('./services/throttle');
const { notifyUser } = require('./services/alerting');
const User = require('./models/User');

const FALLBACK_ORIGIN = process.env.DEMO_SITE_ORIGIN_URL || 'http://demo-site:4000';

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (!res.headersSent) res.status(502).send('Origin unreachable');
});

router.use(async (req, res) => {
  const tenant = req.tenant;
  const { tenantId } = tenant;
  const originUrl = tenant.originUrl || FALLBACK_ORIGIN;

  // Fast-path: reject already-blocked IPs before running guards
  if (await isBlocked(tenantId, req.ip)) {
    return res.status(403).json({ error: 'blocked', reason: 'ip_blocklist' });
  }

  const verdict = await runGuards(req, tenant);

  if (verdict.finalVerdict === 'allow') {
    return proxy.web(req, res, { target: originUrl });
  }

  // Persist block to Redis for IPs that should be banned (rate flood or credential stuffing)
  const shouldBlockIp = verdict.finalVerdict === 'block' &&
    (verdict.triggeredBy === 'rate_flood' || verdict.triggeredBy === 'credential_stuffing');
  if (shouldBlockIp) {
    await blockIp(tenantId, req.ip);
    // Best-effort: notify the user whose login triggered the block
    const username = req.body?.username;
    if (username) {
      User.findOne({ tenantId, username }).then((u) =>
        notifyUser(
          u?.email,
          'Suspicious activity detected on your account',
          `Repeated failed login attempts from IP ${req.ip} have been blocked.\nIf this wasn't you, your account may be under attack.`
        )
      ).catch(() => {});
    }
  }

  res.status(verdict.finalVerdict === 'block' ? 403 : 429).json({ verdict });
});

module.exports = router;
