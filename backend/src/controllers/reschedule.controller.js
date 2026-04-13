// backend/src/controllers/reschedule.controller.js
const { validationResult } = require('express-validator');
const {
  getSlotById, getSlotsByTask, updateSlotStatus,
  insertRescheduledSlot,
} = require('../models/sprint.model');
const { findRescheduleOptions, checkOverflow } = require('../services/reschedule.service');
const { updateTask } = require('../models/task.model');

/**
 * POST /api/reschedule/slots/:slotId/miss
 * Mark a slot as missed + get reschedule options
 */
const missSlot = async (req, res, next) => {
  try {
    const slot = await getSlotById(req.params.slotId, req.user.id);
    if (!slot) return res.status(404).json({ error: { message: 'Slot not found' } });
    if (slot.status !== 'scheduled') {
      return res.status(400).json({ error: { message: `Slot is already ${slot.status}` } });
    }

    // Mark as missed
    await updateSlotStatus(req.params.slotId, req.user.id, 'missed');

    // Find reschedule options (look from today onwards)
    const today = new Date().toISOString().split('T')[0];
    const slotsNeeded = Math.ceil(slot.estimated_minutes / 30);
    const options = await findRescheduleOptions(
      req.user.id, slot.task_id, slot.sprint_id, slotsNeeded, today
    );

    return res.status(200).json({
      message: 'Slot marked as missed',
      missedSlot: slot,
      rescheduleOptions: options,
      instruction: 'Choose an option and call PATCH /api/reschedule/slots/:slotId/confirm',
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/reschedule/slots/:slotId/confirm
 * User confirms a reschedule option
 */
const confirmReschedule = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const { date, startTime, endTime } = req.body;

    const slot = await getSlotById(req.params.slotId, req.user.id);
    if (!slot) return res.status(404).json({ error: { message: 'Slot not found' } });

    // Create new rescheduled slot
    const newSlot = await insertRescheduledSlot(
      slot.sprint_id, slot.task_id, req.user.id,
      date, startTime, endTime,
      'Rescheduled by user after missed slot'
    );

    // Mark original as rescheduled
    await updateSlotStatus(req.params.slotId, req.user.id, 'rescheduled');

    return res.status(200).json({
      message: 'Slot rescheduled successfully',
      newSlot,
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/reschedule/slots/:slotId/complete
 * Mark slot complete + log actual time + handle overflow or early finish
 */
const completeSlot = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const { actualMinutes } = req.body;
    const slot = await getSlotById(req.params.slotId, req.user.id);
    if (!slot) return res.status(404).json({ error: { message: 'Slot not found' } });

    // Mark slot complete
    await updateSlotStatus(
      req.params.slotId, req.user.id, 'completed', new Date().toISOString()
    );

    // Update task actual_minutes
    await updateTask(slot.task_id, req.user.id, {
      status: 'completed',
      actualMinutes,
    });

    // Check overflow / early finish
    const overflowInfo = await checkOverflow(req.user.id, slot, actualMinutes);

    // Build response based on scenario
    if (overflowInfo.overflowMins > 0) {
      if (overflowInfo.canExtend) {
        // Next slot is free — auto-extend silently
        return res.status(200).json({
          message: 'Task completed — ran over slightly, next slot was free',
          actualMinutes,
          overflowMinutes: overflowInfo.overflowMins,
          extended: true,
          freedMinutes: 0,
          nextSlot: {
            date: overflowInfo.nextSlotDate,
            start: overflowInfo.nextSlotStart,
            end: overflowInfo.nextSlotEnd,
            freedAfterOverflow: (30 - overflowInfo.overflowMins),
          },
        });
      } else {
        // Next slot is blocked — find reschedule options for overflow
        const today = new Date().toISOString().split('T')[0];
        const overflowSlotsNeeded = Math.ceil(overflowInfo.overflowMins / 30);
        const options = await findRescheduleOptions(
          req.user.id, slot.task_id, slot.sprint_id, overflowSlotsNeeded, today
        );
        return res.status(200).json({
          message: 'Task completed — ran over and next slot is blocked',
          actualMinutes,
          overflowMinutes: overflowInfo.overflowMins,
          extended: false,
          rescheduleOptions: options,
          instruction: 'Confirm a reschedule option for the overflow time',
        });
      }
    }

    // Finished on time or early
    return res.status(200).json({
      message: overflowInfo.freedMins > 0
        ? `Task completed early — ${overflowInfo.freedMins} min freed up`
        : 'Task completed',
      actualMinutes,
      freedMinutes: overflowInfo.freedMins,
      overflowMinutes: 0,
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/reschedule/slots/:slotId/options
 * Get reschedule options without marking as missed (preview)
 */
const getOptions = async (req, res, next) => {
  try {
    const slot = await getSlotById(req.params.slotId, req.user.id);
    if (!slot) return res.status(404).json({ error: { message: 'Slot not found' } });

    const today = new Date().toISOString().split('T')[0];
    const slotsNeeded = Math.ceil(slot.estimated_minutes / 30);
    const options = await findRescheduleOptions(
      req.user.id, slot.task_id, slot.sprint_id, slotsNeeded, today
    );

    return res.status(200).json({ slot, rescheduleOptions: options });
  } catch (err) { next(err); }
};

module.exports = { missSlot, confirmReschedule, completeSlot, getOptions };