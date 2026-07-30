// backend/src/middleware/auth.middleware.js
const { verifyAccessToken } = require('../utils/jwt.utils');

/**
 * authenticate — verifies JWT and attaches user payload to req.user
 * Use on any route that requires a logged-in user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { message: 'Token expired' } });
    }
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
};

/**
 * authorize — RBAC role check
 * Usage: authorize('student') or authorize('student', 'professional')
 * Always use AFTER authenticate
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Not authenticated' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { message: `Access denied. Required role: ${roles.join(' or ')}` },
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };