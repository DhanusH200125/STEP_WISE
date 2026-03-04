// backend/src/controllers/routine.controller.js
const { validationResult } = require('express-validator');
const {
  upsertSleepSchedule, getSleepSchedule,
  createBlock, getBlocks, getBlockById,
  updateBlock, deleteBlock, findOverlappingBlocks,
} = require('../models/routine.model');
const { computeCapacity } = require('../services/capacity.service');

// ── Sleep ───────────────────────────────────────────────────

const setSleep = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const { sleepTime, wakeTime } = req.body;
    const schedule = await upsertSleepSchedule(req.user.id, sleepTime, wakeTime);
    return res.status(200).json({ message: 'Sleep schedule saved', schedule });
  } catch (err) { next(err); }
};

const getSleep = async (req, res, next) => {
  try {
    const schedule = await getSleepSchedule(req.user.id);
    return res.status(200).json({ schedule });
  } catch (err) { next(err); }
};

// ── Routine Blocks ──────────────────────────────────────────

const addBlock = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const { title, dayOfWeek, startTime, endTime } = req.body;

    // Overlap detection (FR-3)
    const overlaps = await findOverlappingBlocks(req.user.id, dayOfWeek, startTime, endTime);
    if (overlaps.length > 0) {
      return res.status(409).json({
        error: { message: 'Time block overlaps with an existing commitment', conflicts: overlaps },
      });
    }

    const block = await createBlock(req.user.id, { title, dayOfWeek, startTime, endTime });
    return res.status(201).json({ message: 'Routine block added', block });
  } catch (err) { next(err); }
};

const listBlocks = async (req, res, next) => {
  try {
    const blocks = await getBlocks(req.user.id);
    return res.status(200).json({ blocks });
  } catch (err) { next(err); }
};

const editBlock = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const { id } = req.params;
    const existing = await getBlockById(id, req.user.id);
    if (!existing) return res.status(404).json({ error: { message: 'Block not found' } });

    const { title, dayOfWeek, startTime, endTime } = req.body;
    const day = dayOfWeek || existing.day_of_week;
    const start = startTime || existing.start_time.slice(0, 5);
    const end = endTime || existing.end_time.slice(0, 5);

    const overlaps = await findOverlappingBlocks(req.user.id, day, start, end, id);
    if (overlaps.length > 0) {
      return res.status(409).json({
        error: { message: 'Updated block overlaps with an existing commitment', conflicts: overlaps },
      });
    }

    const block = await updateBlock(id, req.user.id, { title, dayOfWeek, startTime, endTime });
    return res.status(200).json({ message: 'Block updated', block });
  } catch (err) { next(err); }
};

const removeBlock = async (req, res, next) => {
  try {
    const deleted = await deleteBlock(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: { message: 'Block not found' } });
    return res.status(200).json({ message: 'Block removed' });
  } catch (err) { next(err); }
};

// ── Capacity (FR-4) ─────────────────────────────────────────

const getCapacity = async (req, res, next) => {
  try {
    const capacity = await computeCapacity(req.user.id);
    return res.status(200).json({ capacity });
  } catch (err) { next(err); }
};

module.exports = { setSleep, getSleep, addBlock, listBlocks, editBlock, removeBlock, getCapacity };