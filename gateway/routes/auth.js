const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const redis = require('../config/redis');
const defaultTenant = require('../config/defaultTenant');
const { lockAccount, isLocked } = require('../services/lockout');
const { notifyUser } = require('../services/alerting');

function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user._id, tenantId: user.tenantId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_TTL || '15m' }
  );
  const refreshToken = jwt.sign(
    { sub: user._id, tenantId: user.tenantId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_TTL || '7d' }
  );
  return { accessToken, refreshToken };
}

router.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });

  const existing = await User.findOne({ tenantId: defaultTenant.tenantId, username });
  if (existing) return res.status(409).json({ error: 'username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    tenantId: defaultTenant.tenantId,
    username,
    passwordHash,
    email: email || null,
    knownDevices: [],
  });
  res.status(201).json({ userId: user._id });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;
  const tenantId = defaultTenant.tenantId;

  // Pre-check: account already locked from a previous brute-force window
  if (await isLocked(tenantId, username)) {
    return res.status(423).json({ error: 'account_locked', reason: 'brute_force' });
  }

  const user = await User.findOne({ tenantId, username });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));

  if (!valid) {
    const failCount = await redis.incr(`failedlogin:${tenantId}:${username}`);
    await redis.expire(`failedlogin:${tenantId}:${username}`, 300);
    await redis.sadd(`failedlogin_ip:${tenantId}:${ip}`, username);
    await redis.expire(`failedlogin_ip:${tenantId}:${ip}`, 300);
    await redis.incr(`failedlogin_ip_total:${tenantId}:${ip}`);
    await redis.expire(`failedlogin_ip_total:${tenantId}:${ip}`, 300);

    if (failCount >= defaultTenant.thresholds.authFailMax) {
      await lockAccount(tenantId, username);
      // Fire-and-forget user notification
      notifyUser(
        user?.email,
        'Your account has been locked',
        `Your account "${username}" was locked due to too many failed login attempts.\nIf this wasn't you, please contact support.`
      ).catch(() => {});
      return res.status(423).json({ error: 'account_locked', reason: 'brute_force' });
    }

    return res.status(401).json({ error: 'invalid credentials' });
  }

  // Reset fail counters on successful login
  await redis.del(`failedlogin:${tenantId}:${username}`);

  const knownDevice = user.knownDevices.some(
    (d) => d.ip === ip && d.userAgent === req.headers['user-agent']
  );
  if (!knownDevice) {
    user.knownDevices.push({ ip, userAgent: req.headers['user-agent'], firstSeenAt: new Date() });
    await user.save();
    // TODO Phase 5: send OTP challenge instead of letting straight through
  }

  res.json(issueTokens(user));
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'invalid token type' });

    // Check if token has been revoked
    const revoked = await redis.exists(`revoked:${payload.jti || payload.sub}`);
    if (revoked) return res.status(401).json({ error: 'token revoked' });

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'user not found' });

    const { accessToken } = issueTokens(user);
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: 'invalid or expired token' });
  }
});

module.exports = router;
