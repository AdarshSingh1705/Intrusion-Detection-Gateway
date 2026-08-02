// gateway/models/Tenant.js
// Reference: LLD S4 - tenants collection
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  tenantId: { type: String, unique: true, index: true },
  domain: { type: String, unique: true, index: true },
  originUrl: String,
  apiKeyHash: String, // bcrypt hash, never store plaintext
  thresholds: {
    authFailMax: { type: Number, default: 5 },
    rateWarnMax: { type: Number, default: 100 },
    rateBlockMax: { type: Number, default: 300 },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Tenant', tenantSchema);
