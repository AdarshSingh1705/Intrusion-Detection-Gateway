const requireAuth = require('./requireAuth');

module.exports = function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'superadmin access required' });
    }

    next();
  });
};
