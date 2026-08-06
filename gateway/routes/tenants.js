const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const requireTenantAdmin = require('../middleware/requireTenantAdmin');

router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const { domain, originUrl, adminUsername, adminPassword, adminEmail } = req.body;
    if (!domain || !originUrl || !adminUsername || !adminPassword)
      return res.status(400).json({ error: 'domain, originUrl, adminUsername and adminPassword required' });

    const apiKey = uuidv4();
    const apiKeyHash = await bcrypt.hash(apiKey, 10);
    const tenantId = uuidv4();

    const tenant = await Tenant.create({ tenantId, domain, originUrl, apiKeyHash });

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      tenantId,
      username: adminUsername,
      passwordHash,
      email: adminEmail || null,
      role: 'admin',
      knownDevices: [],
    });

    res.status(201).json({ tenantId: tenant.tenantId, apiKey, adminUsername });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:tenantId', requireTenantAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ tenantId: req.user.tenantId }, '-apiKeyHash');
    if (!tenant) return res.status(404).json({ error: 'tenant not found' });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:tenantId/thresholds', requireTenantAdmin, async (req, res) => {
  try {
    const { authFailMax, rateWarnMax, rateBlockMax } = req.body;
    await Tenant.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { $set: { 'thresholds.authFailMax': authFailMax, 'thresholds.rateWarnMax': rateWarnMax, 'thresholds.rateBlockMax': rateBlockMax } }
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
