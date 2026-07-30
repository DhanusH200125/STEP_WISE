// backend/src/routes/sprint.routes.js
const express = require('express');
const { body } = require('express-validator');
const { generate, getSprint, accept, toggleLock } = require('../controllers/sprint.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.post('/generate', [
  body('weekStart').isDate().withMessage('weekStart must be YYYY-MM-DD (Monday of the week)'),
], generate);

router.get('/:weekStart', getSprint);
router.patch('/:id/accept', accept);
router.patch('/:id/slots/:slotId/lock', [
  body('isLocked').isBoolean().withMessage('isLocked must be true or false'),
], toggleLock);

module.exports = router;