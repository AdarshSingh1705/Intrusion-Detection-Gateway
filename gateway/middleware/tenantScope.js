const Tenant = require('../models/Tenant');
const defaultTenant = require('../config/defaultTenant');

// Resolves the incoming request's tenant from req.hostname.
// Falls back to the seeded 'default' tenant for localhost / unknown hosts.
module.exports = async function tenantScope(req, res, next) {
  try {
    const hostname = req.hostname; // strips port
    const tenant = await Tenant.findOne({ domain: hostname });
    if (tenant) {
      req.tenant = { tenantId: tenant.tenantId, thresholds: tenant.thresholds, originUrl: tenant.originUrl };
    } else {
      // Fall back to default tenant (covers localhost dev + the seeded demo)
      req.tenant = defaultTenant;
    }
    req.tenantId = req.tenant.tenantId;
  } catch (err) {
    // If DB is down, fail-open with default tenant rather than crashing
    req.tenant = defaultTenant;
    req.tenantId = defaultTenant.tenantId;
  }
  next();
};
