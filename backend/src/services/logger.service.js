// backend/src/services/logger.service.js
const { log } = require('../models/log.model');

/**
 * Thin wrappers around log() for each event type.
 * Call these from controllers after key actions.
 */

const taskCreated = (userId, task) =>
  log(userId, 'task_created', {
    taskId: task.id,
    metadata: {
      title: task.title,
      domain: task.domain,
      priority: task.priority,
      estimatedMinutes: task.estimated_minutes,
    },
  });

const taskUpdated = (userId, task, changedFields) =>
  log(userId, 'task_updated', {
    taskId: task.id,
    metadata: { changedFields },
  });

const taskCompleted = (userId, task, actualMinutes) =>
  log(userId, 'task_completed', {
    taskId: task.id,
    metadata: {
      title: task.title,
      domain: task.domain,
      plannedMinutes: task.estimated_minutes,
      actualMinutes,
      variance: actualMinutes - task.estimated_minutes,
    },
  });

const slotMissed = (userId, slot) =>
  log(userId, 'slot_missed', {
    taskId: slot.task_id,
    slotId: slot.id,
    sprintId: slot.sprint_id,
    metadata: {
      scheduledDate: slot.scheduled_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      taskTitle: slot.title,
    },
  });

const slotCompleted = (userId, slot, actualMinutes) =>
  log(userId, 'slot_completed', {
    taskId: slot.task_id,
    slotId: slot.id,
    sprintId: slot.sprint_id,
    metadata: {
      scheduledDate: slot.scheduled_date,
      startTime: slot.start_time,
      actualMinutes,
      freedMinutes: Math.max(0,
        ((new Date(`1970-01-01T${slot.end_time}`) - new Date(`1970-01-01T${slot.start_time}`)) / 60000)
        - actualMinutes
      ),
    },
  });

const slotRescheduled = (userId, oldSlot, newSlot) =>
  log(userId, 'slot_rescheduled', {
    taskId: oldSlot.task_id,
    slotId: oldSlot.id,
    sprintId: oldSlot.sprint_id,
    metadata: {
      fromDate: oldSlot.scheduled_date,
      fromTime: oldSlot.start_time,
      toDate: newSlot.scheduled_date,
      toTime: newSlot.start_time,
    },
  });

const sprintGenerated = (userId, sprint, summary) =>
  log(userId, 'sprint_generated', {
    sprintId: sprint.id,
    metadata: {
      weekStart: sprint.week_start,
      tasksScheduled: summary.tasksScheduled,
      plannedMinutes: summary.plannedMinutes,
      capacityUsedPercent: summary.capacityUsedPercent,
    },
  });

const sprintAccepted = (userId, sprint) =>
  log(userId, 'sprint_accepted', {
    sprintId: sprint.id,
    metadata: { weekStart: sprint.week_start },
  });

module.exports = {
  taskCreated, taskUpdated, taskCompleted,
  slotMissed, slotCompleted, slotRescheduled,
  sprintGenerated, sprintAccepted,
};