// backend/src/routes/log.routes.js
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getLogs } = require('../models/log.model');

const router = express.Router();
router.use(authenticate);

// GET /api/logs — get recent activity logs
router.get('/', async (req, res, next) => {
  try {
    const { limit, eventType, taskId } = req.query;
    const logs = await getLogs(req.user.id, {
      limit: limit ? parseInt(limit) : 50,
      eventType,
      taskId,
    });
    return res.status(200).json({ logs, count: logs.length });
  } catch (err) { next(err); }
});

module.exports = router;