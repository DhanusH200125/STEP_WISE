// backend/src/utils/jwt.utils.js
const jwt = require('jsonwebtoken');

/**
 * Generate a short-lived access token (15 min)
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

/**
 * Generate a long-lived refresh token (7 days)
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify an access token — returns payload or throws
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

/**
 * Verify a refresh token — returns payload or throws
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Get expiry Date object from JWT expiry string (e.g. "7d")
 */
const getExpiryDate = (expiresIn) => {
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  const seconds = parseInt(match[1]) * units[match[2]];
  return new Date(Date.now() + seconds * 1000);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getExpiryDate,
};