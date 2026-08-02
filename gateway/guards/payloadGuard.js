const signatures = require('../config/signatures');

function evaluatePayloadGuard(req) {
  const target = JSON.stringify(req.query) + JSON.stringify(req.body || {}) + (req.headers.cookie || '');

  for (const pattern of signatures) {
    if (pattern.regex.test(target)) {
      return { verdict: 'malicious', reason: pattern.name, action: 'block' };
    }
  }

  return { verdict: 'clean' };
}

module.exports = evaluatePayloadGuard;
