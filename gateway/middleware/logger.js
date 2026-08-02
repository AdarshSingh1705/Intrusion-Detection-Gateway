const Event = require('../models/Event');

async function logEvent(req, verdict) {
  return Event.create({
    tenantId: req.tenantId || 'default',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.path,
    verdict: verdict.finalVerdict,
    ruleTriggered: verdict.triggeredBy,
    severity: verdict.severity,
  }).catch((err) => {
    console.error('Event log write failed', err.message);
    return null;
  });
}

module.exports = logEvent;
