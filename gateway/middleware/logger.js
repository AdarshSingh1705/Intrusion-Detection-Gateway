const Event = require('../models/Event');

const SENSITIVE_KEYS = /password|secret|token|apikey|api_key/i;

function buildPayloadSnippet(req) {
  const parts = [];
  if (req.query && Object.keys(req.query).length) {
    parts.push(JSON.stringify(redactObject(req.query)));
  }
  if (req.body && Object.keys(req.body).length) {
    parts.push(JSON.stringify(redactObject(req.body)));
  }
  const snippet = parts.join(' ');
  return snippet.length > 500 ? snippet.slice(0, 500) + '…' : snippet || undefined;
}

function redactObject(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : value;
  }
  return out;
}

async function logEvent(req, verdict) {
  const ruleTriggered = verdict.degraded ? 'redis_degraded' : verdict.triggeredBy;

  return Event.create({
    tenantId: req.tenantId || 'default',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.baseUrl ? req.baseUrl + req.path : req.path,
    payloadSnippet: buildPayloadSnippet(req),
    verdict: verdict.finalVerdict,
    ruleTriggered,
    severity: verdict.degraded ? 'low' : verdict.severity,
  }).catch((err) => {
    console.error('Event log write failed', err.message);
    return null;
  });
}

module.exports = logEvent;
