const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const Tenant = require('../models/Tenant');

router.post('/', async (req, res) => {
  try {
    const { domain, originUrl } = req.body;
    if (!domain || !originUrl)
      return res.status(400).json({ error: 'domain and originUrl required' });

    const apiKey = uuidv4();
    const apiKeyHash = await bcrypt.hash(apiKey, 10);
    const tenantId = uuidv4();

    const tenant = await Tenant.create({ tenantId, domain, originUrl, apiKeyHash });
    // Return plaintext apiKey once — never stored, only the hash is
    res.status(201).json({ tenantId: tenant.tenantId, apiKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:tenantId', async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ tenantId: req.params.tenantId }, '-apiKeyHash');
    if (!tenant) return res.status(404).json({ error: 'tenant not found' });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:tenantId/thresholds', async (req, res) => {
  try {
    const { authFailMax, rateWarnMax, rateBlockMax } = req.body;
    await Tenant.findOneAndUpdate(
      { tenantId: req.params.tenantId },
      { $set: { 'thresholds.authFailMax': authFailMax, 'thresholds.rateWarnMax': rateWarnMax, 'thresholds.rateBlockMax': rateBlockMax } }
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
