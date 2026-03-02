// backend/src/models/token.model.js
const { query } = require('../config/db');
const crypto = require('crypto');

/**
 * Hash a token for safe storage (never store raw tokens)
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Save a refresh token to DB
 */
const saveRefreshToken = async (userId, token, expiresAt) => {
  const tokenHash = hashToken(token);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
};

/**
 * Find a refresh token by its raw value
 */
const findRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  const { rows } = await query(
    `SELECT id, user_id, expires_at
     FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
};

/**
 * Delete a specific refresh token (logout)
 */
const deleteRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  await query(
    `DELETE FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
};

/**
 * Delete all refresh tokens for a user (logout all devices)
 */
const deleteAllUserTokens = async (userId) => {
  await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
};

/**
 * Clean up expired tokens (run periodically)
 */
const deleteExpiredTokens = async () => {
  await query(`DELETE FROM refresh_tokens WHERE expires_at <= NOW()`);
};

module.exports = {
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteAllUserTokens,
  deleteExpiredTokens,
};