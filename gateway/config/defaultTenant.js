// Temporary stand-in until Phase 6 replaces this with a real per-domain lookup.
module.exports = {
  tenantId: 'default',
  thresholds: { authFailMax: 5, rateWarnMax: 5, rateBlockMax: 10 },
};