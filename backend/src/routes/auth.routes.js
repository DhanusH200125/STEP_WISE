// backend/src/routes/auth.routes.js
const express = require('express');
const { body } = require('express-validator');
const { register, login, refresh, logout, logoutAll, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// ── Validation rules ───────────────────────────────────────────

const registerRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('role').optional().isIn(['student', 'professional']).withMessage('Role must be student or professional'),
  body('timezone').optional().isString(),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Routes ─────────────────────────────────────────────────────

// Public routes
router.post('/register', registerRules, register);
router.post('/login', loginRules, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.post('/logout-all', authenticate, logoutAll);
router.get('/me', authenticate, me);

module.exports = router;