// backend/src/routes/user.routes.js
const express = require('express');
const { body } = require('express-validator');
const { getMe, updateMyPreferences } = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Validation rules for preferences update
const preferencesRules = [
  body('working_days')
    .optional()
    .isArray().withMessage('working_days must be an array')
    .custom((days) => {
      const valid = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      return days.every(d => valid.includes(d));
    }).withMessage('Invalid day value'),

  body('notification_pref')
    .optional()
    .isIn(['email', 'push', 'none'])
    .withMessage('notification_pref must be email, push, or none'),

  body('growth_target_hours_weekly')
    .optional()
    .isFloat({ min: 0, max: 168 })
    .withMessage('growth_target_hours_weekly must be between 0 and 168'),

  body('quiet_hours_start')
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('quiet_hours_start must be in HH:MM format'),

  body('quiet_hours_end')
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('quiet_hours_end must be in HH:MM format'),

  body('realism_factor')
    .optional()
    .isFloat({ min: 0.1, max: 1.0 })
    .withMessage('realism_factor must be between 0.1 and 1.0'),
];

// Routes
router.get('/me', getMe);
router.patch('/me/preferences', preferencesRules, updateMyPreferences);

module.exports = router;