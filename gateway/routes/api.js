const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Alert = require('../models/Alert');
const { blockIp, unblockIp } = require('../services/throttle');
const defaultTenant = require('../config/defaultTenant');

router.get('/events', async (req, res) => {
  try {
    const { since, severity, limit = 100 } = req.query;
    const filter = { tenantId: defaultTenant.tenantId };
    if (since) filter.timestamp = { $gte: new Date(since) };
    if (severity) filter.severity = severity;
    const events = await Event.find(filter).sort({ timestamp: -1 }).limit(Number(limit));
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/events/ip/:ip', async (req, res) => {
  try {
    const events = await Event.find({ tenantId: defaultTenant.tenantId, ip: req.params.ip })
      .sort({ timestamp: -1 })
      .limit(200);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const filter = { tenantId: defaultTenant.tenantId };
    if (req.query.acknowledged !== undefined)
      filter.acknowledged = req.query.acknowledged === 'true';
    const alerts = await Alert.find(filter)
      .populate('eventId')
      .sort({ sentAt: -1 })
      .limit(100);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/alerts/:id/acknowledge', async (req, res) => {
  try {
    await Alert.findByIdAndUpdate(req.params.id, { acknowledged: true });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/blocklist/:ip', async (req, res) => {
  try {
    await blockIp(defaultTenant.tenantId, req.params.ip);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/blocklist/:ip', async (req, res) => {
  try {
    await unblockIp(defaultTenant.tenantId, req.params.ip);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
