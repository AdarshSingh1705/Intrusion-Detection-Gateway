const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Alert = require('../models/Alert');
const { blockIp, unblockIp, isBlocked, getBlockedIps } = require('../services/throttle');
const requireTenantAdmin = require('../middleware/requireTenantAdmin');

router.get('/blocklist', requireTenantAdmin, async (req, res) => {
  try {
    const list = await getBlockedIps(req.user.tenantId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/blocklist/:ip', requireTenantAdmin, async (req, res) => {
  try {
    const blocked = await isBlocked(req.user.tenantId, req.params.ip);
    res.json({ blocked: Boolean(blocked) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', requireTenantAdmin, async (req, res) => {
  try {
    const { since, severity, limit = 100 } = req.query;
    const filter = { tenantId: req.user.tenantId };
    if (since) filter.timestamp = { $gte: new Date(since) };
    if (severity) filter.severity = severity;
    const events = await Event.find(filter).sort({ timestamp: -1 }).limit(Number(limit));
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/events/ip/:ip', requireTenantAdmin, async (req, res) => {
  try {
    const events = await Event.find({ tenantId: req.user.tenantId, ip: req.params.ip })
      .sort({ timestamp: -1 })
      .limit(200);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/alerts', requireTenantAdmin, async (req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
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

router.patch('/alerts/:id/acknowledge', requireTenantAdmin, async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!alert) return res.status(404).json({ error: 'alert not found' });
    alert.acknowledged = true;
    await alert.save();
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/blocklist/:ip', requireTenantAdmin, async (req, res) => {
  try {
    await blockIp(req.user.tenantId, req.params.ip);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/blocklist/:ip', requireTenantAdmin, async (req, res) => {
  try {
    await unblockIp(req.user.tenantId, req.params.ip);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
