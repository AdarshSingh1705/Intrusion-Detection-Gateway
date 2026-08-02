// gateway/models/User.js
// Reference: LLD S4 - users collection
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  tenantId: { type: String, index: true },
  username: String,
  passwordHash: String,
  email: { type: String, default: null },
  knownDevices: [{ ip: String, userAgent: String, firstSeenAt: Date }],
  createdAt: { type: Date, default: Date.now },
});
userSchema.index({ tenantId: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
