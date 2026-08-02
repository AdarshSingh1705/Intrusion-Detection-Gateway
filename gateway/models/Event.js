// gateway/models/Event.js
// Reference: LLD S4 - events collection (the audit/evidence trail)
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  tenantId: { type: String, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  ip: { type: String, index: true },
  userAgent: String,
  method: String,
  path: String,
  payloadSnippet: String, // truncated + redacted, never log raw passwords
  verdict: { type: String, enum: ['allow', 'throttle', 'block', 'challenge'] },
  ruleTriggered: String,
  severity: { type: String, enum: ['low', 'medium', 'high'] },
});

module.exports = mongoose.model('Event', eventSchema);
