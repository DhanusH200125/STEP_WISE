// backend/src/controllers/user.controller.js
const { validationResult } = require('express-validator');
const {
  findUserWithPreferences,
  updatePreferences,
} = require('../models/user.model');

/**
 * GET /api/users/me
 * Returns current user + their preferences
 */
const getMe = async (req, res, next) => {
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

/**
 * PATCH /api/users/me/preferences
 * Update user preferences (partial update — only send what changed)
 */
const updateMyPreferences = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { message: 'Validation failed', details: errors.array() },
      });
    }

    const updated = await updatePreferences(req.user.id, req.body);
    if (!updated) {
      return res.status(400).json({ error: { message: 'No valid fields to update' } });
    }

    return res.status(200).json({
      message: 'Preferences updated successfully',
      preferences: updated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe, updateMyPreferences };