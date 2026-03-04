// backend/src/routes/routine.routes.js
const express = require('express');
const { body } = require('express-validator');
const {
  setSleep, getSleep,
  addBlock, listBlocks, editBlock, removeBlock,
  getCapacity,
} = require('../controllers/routine.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const sleepRules = [
  body('sleepTime').matches(timeFormat).withMessage('sleepTime must be HH:MM'),
  body('wakeTime').matches(timeFormat).withMessage('wakeTime must be HH:MM'),
];

const blockRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('dayOfWeek').isIn(validDays).withMessage('Invalid day'),
  body('startTime').matches(timeFormat).withMessage('startTime must be HH:MM'),
  body('endTime').matches(timeFormat).withMessage('endTime must be HH:MM'),
];

// Sleep schedule
router.post('/sleep', sleepRules, setSleep);
router.get('/sleep', getSleep);

// Routine blocks
router.post('/blocks', blockRules, addBlock);
router.get('/blocks', listBlocks);
router.put('/blocks/:id', blockRules, editBlock);
router.delete('/blocks/:id', removeBlock);

// Capacity computation
router.get('/capacity', getCapacity);

module.exports = router;