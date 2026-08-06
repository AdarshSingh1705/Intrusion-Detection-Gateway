const requireAuth = require('./requireAuth');
const { enforceTenantOwnership } = require('./tenantPolicy');

module.exports = function requireTenantAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const role = req.user?.role;

    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ error: 'tenant admin access required' });
    }

    return enforceTenantOwnership(req, res, next);
  });
};
