// gateway/models/Alert.js
// Reference: LLD S4 - alerts collection
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  tenantId: { type: String, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  channel: { type: String, enum: ['email', 'webhook', 'dashboard'] },
  sentAt: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false },
});

module.exports = mongoose.model('Alert', alertSchema);
