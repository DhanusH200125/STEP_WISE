// backend/src/routes/task.routes.js
const express = require('express');
const { body, query } = require('express-validator');
const { addTask, listTasks, getTask, editTask, removeTask, completeTask } = require('../controllers/task.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

const domains = ['work_study', 'personal_growth', 'health', 'life_admin'];
const priorities = ['low', 'medium', 'high', 'critical'];
const energyLevels = ['low', 'medium', 'high'];
const statuses = ['backlog', 'planned', 'in_progress', 'completed', 'skipped'];

const taskRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('domain').isIn(domains).withMessage(`Domain must be one of: ${domains.join(', ')}`),
  body('estimatedMinutes')
    .isInt({ min: 1 }).withMessage('estimatedMinutes must be a positive integer'),
  body('priority').optional().isIn(priorities).withMessage('Invalid priority'),
  body('energyLevel').optional().isIn(energyLevels).withMessage('Invalid energy level'),
  body('deadline').optional().isDate().withMessage('deadline must be YYYY-MM-DD'),
  body('deadlineType').optional().isIn(['hard', 'soft']).withMessage('deadlineType must be hard or soft'),
  body('description').optional().isString(),
];

const updateRules = [
  body('title').optional().trim().notEmpty(),
  body('domain').optional().isIn(domains),
  body('estimatedMinutes').optional().isInt({ min: 1 }),
  body('priority').optional().isIn(priorities),
  body('energyLevel').optional().isIn(energyLevels),
  body('status').optional().isIn(statuses),
  body('deadline').optional().isDate(),
  body('deadlineType').optional().isIn(['hard', 'soft']),
  body('isLocked').optional().isBoolean(),
];

router.post('/', taskRules, addTask);
router.get('/', listTasks);
router.get('/:id', getTask);
router.patch('/:id', updateRules, editTask);
router.delete('/:id', removeTask);
router.post('/:id/complete', completeTask);

module.exports = router;