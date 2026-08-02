// gateway/middleware/tenantScope.js
// Resolves the incoming request's tenant from req.hostname and attaches
// req.tenantId so every downstream query is scoped correctly.
// Reference: HLD S9 (Multi-Tenancy Model)
// For now defaults to 'default' tenant — full per-domain lookup is a future phase.
module.exports = async function tenantScope(req, res, next) {
  req.tenantId = 'default';
  next();
};
