const runGuards = require('../core/runGuards');

module.exports = async function guardCheck(req, res, next) {
  const tenant = req.tenant;
  if (!tenant) return res.status(503).json({ error: 'tenant context unavailable' });

  const verdict = await runGuards(req, tenant);
  if (verdict.finalVerdict === 'allow') return next();
  res.status(verdict.finalVerdict === 'block' ? 403 : 429).json({ verdict });
};
