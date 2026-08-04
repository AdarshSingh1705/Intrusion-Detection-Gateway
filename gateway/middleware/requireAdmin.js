const requireAuth = require('./requireAuth');

module.exports = function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'admin access required' });
    }

    next();
  });
};
