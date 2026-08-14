const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing token' });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'invalid token type' });
    }
  
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid or expired token' });
  }
};
