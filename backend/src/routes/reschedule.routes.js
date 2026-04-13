// backend/src/routes/reschedule.routes.js
const express = require('express');
const { body } = require('express-validator');
const {
  missSlot, confirmReschedule, completeSlot, getOptions,
} = require('../controllers/reschedule.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

router.post('/slots/:slotId/miss', missSlot);

router.post('/slots/:slotId/confirm', [
  body('date').isDate().withMessage('date must be YYYY-MM-DD'),
  body('startTime').matches(timeFormat).withMessage('startTime must be HH:MM'),
  body('endTime').matches(timeFormat).withMessage('endTime must be HH:MM'),
], confirmReschedule);

router.post('/slots/:slotId/complete', [
  body('actualMinutes').isInt({ min: 1 }).withMessage('actualMinutes must be a positive integer'),
], completeSlot);

router.get('/slots/:slotId/options', getOptions);

module.exports = router;