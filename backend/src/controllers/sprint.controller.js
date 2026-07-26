// backend/src/controllers/sprint.controller.js
const { validationResult } = require('express-validator');
const { generateSprint } = require('../services/sprint.service');
const { getSprintWithTasks, acceptSprint, lockSlot } = require('../models/sprint.model');
const logger = require('../services/logger.service');

const generate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const { weekStart } = req.body;
    const result = await generateSprint(req.user.id, weekStart);
    await logger.sprintGenerated(req.user.id, result.sprint, result.summary); // Log sprint generation with summary details
    return res.status(200).json({
      message: 'Sprint generated successfully',
      ...result,
    });
  } catch (err) { next(err); }
};

const getSprint = async (req, res, next) => {
  try {
    const { weekStart } = req.params;
    const sprint = await getSprintWithTasks(req.user.id, weekStart);
    if (!sprint) return res.status(404).json({ error: { message: 'No sprint found for this week' } });
    return res.status(200).json({ sprint });
  } catch (err) { next(err); }
};

const accept = async (req, res, next) => {
  try {
    const sprint = await acceptSprint(req.params.id, req.user.id);
    await logger.sprintAccepted(req.user.id, sprint);  // Log acceptance with sprint details

    if (!sprint) return res.status(404).json({ error: { message: 'Sprint not found' } });
    return res.status(200).json({ message: 'Sprint accepted and activated', sprint });
  } catch (err) { next(err); }
};

const toggleLock = async (req, res, next) => {
  try {
    const { isLocked } = req.body;
    const slot = await lockSlot(req.params.slotId, req.user.id, isLocked);
    if (!slot) return res.status(404).json({ error: { message: 'Slot not found' } });
    return res.status(200).json({ message: `Slot ${isLocked ? 'locked' : 'unlocked'}`, slot });
  } catch (err) { next(err); }
};

module.exports = { generate, getSprint, accept, toggleLock };