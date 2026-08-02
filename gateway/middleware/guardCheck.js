const runGuards = require('../core/runGuards');
const defaultTenant = require('../config/defaultTenant');

module.exports = async function guardCheck(req, res, next) {
  const verdict = await runGuards(req, defaultTenant);
  if (verdict.finalVerdict === 'allow') return next();
  res.status(verdict.finalVerdict === 'block' ? 403 : 429).json({ verdict });
};