// backend/src/controllers/auth.controller.js
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const { getClient } = require('../config/db');

const {
  findUserByEmail,
  findUserWithPreferences,
  createUser,
  createDefaultPreferences,
} = require('../models/user.model');

const {
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteAllUserTokens,
} = require('../models/token.model');

const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getExpiryDate,
} = require('../utils/jwt.utils');

const SALT_ROUNDS = 12;

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { email, password, fullName, role, timezone } = req.body;

    // Check if email already exists
    const existing = await findUserByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: { message: 'Email already registered' } });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user + preferences in a transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const user = await createUser(client, {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        role: role || 'student',
        timezone,
      });
      await createDefaultPreferences(client, user.id);
      await client.query('COMMIT');

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user.id);
      const refreshExpiry = getExpiryDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
      await saveRefreshToken(user.id, refreshToken, refreshExpiry);

      return res.status(201).json({
        message: 'Account created successfully',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          timezone: user.timezone,
        },
        accessToken,
        refreshToken,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { email, password } = req.body;

    const user = await findUserByEmail(email.toLowerCase());
    if (!user) {
      // Same message for both wrong email and wrong password (security)
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);
    const refreshExpiry = getExpiryDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
    await saveRefreshToken(user.id, refreshToken, refreshExpiry);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        timezone: user.timezone,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Accepts refresh token, returns new access token
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: { message: 'Refresh token required' } });
    }

    // Verify JWT signature first
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: { message: 'Invalid or expired refresh token' } });
    }

    // Check it exists in DB (not revoked)
    const storedToken = await findRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(401).json({ error: { message: 'Refresh token revoked or not found' } });
    }

    // Get current user data for new token
    const user = await findUserWithPreferences(payload.sub);
    if (!user) {
      return res.status(401).json({ error: { message: 'User not found' } });
    }

    const newAccessToken = generateAccessToken(user);

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await deleteRefreshToken(refreshToken);
    }
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout-all
 * Logs out from all devices
 */
const logoutAll = async (req, res, next) => {
  try {
    await deleteAllUserTokens(req.user.id);
    return res.status(200).json({ message: 'Logged out from all devices' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Returns current user info
 */
const me = async (req, res, next) => {
  try {
    const user = await findUserWithPreferences(req.user.id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, logoutAll, me };