// Fallback tenant used when req.hostname doesn't match any registered tenant (e.g. localhost dev).
module.exports = {
  tenantId: 'default',
  originUrl: process.env.DEMO_SITE_ORIGIN_URL || 'http://demo-site:4000',
  thresholds: { authFailMax: 5, rateWarnMax: 5, rateBlockMax: 10 },
};