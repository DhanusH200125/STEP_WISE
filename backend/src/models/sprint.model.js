// backend/src/models/sprint.model.js
const { query, getClient } = require('../config/db');

const createSprint = async (client, userId, weekStart, weekEnd, capacityMinutes, realismFactor) => {
  const { rows } = await client.query(
    `INSERT INTO weekly_sprints
       (user_id, week_start, week_end, computed_capacity_minutes, realism_factor_used)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, week_start) DO UPDATE
       SET status = 'draft', computed_capacity_minutes = $4,
           realism_factor_used = $5, updated_at = NOW()
     RETURNING *`,
    [userId, weekStart, weekEnd, capacityMinutes, realismFactor]
  );
  return rows[0];
};

const insertSlots = async (client, slots) => {
  if (slots.length === 0) return [];
  const values = slots.map((s, i) => {
    const base = i * 8;
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
  }).join(',');

  const params = slots.flatMap(s => [
    s.sprintId, s.taskId, s.userId,
    s.scheduledDate, s.startTime, s.endTime,
    s.isLocked, s.recommendationReason,
  ]);

  const { rows } = await client.query(
    `INSERT INTO scheduled_slots
       (sprint_id, task_id, user_id, scheduled_date, start_time, end_time, is_locked, recommendation_reason)
     VALUES ${values} RETURNING *`,
    params
  );
  return rows;
};

const updateSprintPlannedMinutes = async (client, sprintId, plannedMinutes) => {
  await client.query(
    `UPDATE weekly_sprints SET planned_minutes = $1, updated_at = NOW() WHERE id = $2`,
    [plannedMinutes, sprintId]
  );
};

const getSprintByWeek = async (userId, weekStart) => {
  const { rows } = await query(
    `SELECT s.*,
       json_agg(
         json_build_object(
           'id', sl.id, 'task_id', sl.task_id, 'scheduled_date', sl.scheduled_date,
           'start_time', sl.start_time, 'end_time', sl.end_time,
           'status', sl.status, 'is_locked', sl.is_locked,
           'recommendation_reason', sl.recommendation_reason
         ) ORDER BY sl.scheduled_date, sl.start_time
       ) FILTER (WHERE sl.id IS NOT NULL) AS slots
     FROM weekly_sprints s
     LEFT JOIN scheduled_slots sl ON sl.sprint_id = s.id
     WHERE s.user_id = $1 AND s.week_start = $2
     GROUP BY s.id`,
    [userId, weekStart]
  );
  return rows[0] || null;
};

const getSprintWithTasks = async (userId, weekStart) => {
  const { rows } = await query(
    `SELECT s.*,
       json_agg(
         json_build_object(
           'slot_id', sl.id,
           'task_id', sl.task_id,
           'title', t.title,
           'domain', t.domain,
           'priority', t.priority,
           'energy_level', t.energy_level,
           'estimated_minutes', t.estimated_minutes,
           'scheduled_date', sl.scheduled_date,
           'start_time', sl.start_time,
           'end_time', sl.end_time,
           'status', sl.status,
           'is_locked', sl.is_locked,
           'recommendation_reason', sl.recommendation_reason
         ) ORDER BY sl.scheduled_date, sl.start_time
       ) FILTER (WHERE sl.id IS NOT NULL) AS slots
     FROM weekly_sprints s
     LEFT JOIN scheduled_slots sl ON sl.sprint_id = s.id
     LEFT JOIN tasks t ON t.id = sl.task_id
     WHERE s.user_id = $1 AND s.week_start = $2
     GROUP BY s.id`,
    [userId, weekStart]
  );
  return rows[0] || null;
};

const acceptSprint = async (sprintId, userId) => {
  const { rows } = await query(
    `UPDATE weekly_sprints SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [sprintId, userId]
  );
  return rows[0] || null;
};

const lockSlot = async (slotId, userId, isLocked) => {
  const { rows } = await query(
    `UPDATE scheduled_slots SET is_locked = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [isLocked, slotId, userId]
  );
  return rows[0] || null;
};

const deleteSprintSlots = async (client, sprintId) => {
  await client.query(`DELETE FROM scheduled_slots WHERE sprint_id = $1`, [sprintId]);
};


// Get a single slot by ID
const getSlotById = async (slotId, userId) => {
  const { rows } = await query(
    `SELECT sl.*, t.title, t.estimated_minutes, t.energy_level, t.priority, t.domain
     FROM scheduled_slots sl
     JOIN tasks t ON t.id = sl.task_id
     WHERE sl.id = $1 AND sl.user_id = $2`,
    [slotId, userId]
  );
  return rows[0] || null;
};

// Get all slots for a task within a sprint
const getSlotsByTask = async (taskId, sprintId) => {
  const { rows } = await query(
    `SELECT * FROM scheduled_slots
     WHERE task_id = $1 AND sprint_id = $2
     ORDER BY scheduled_date, start_time`,
    [taskId, sprintId]
  );
  return rows;
};

// Mark a slot with a new status
const updateSlotStatus = async (slotId, userId, status, completedAt = null) => {
  const { rows } = await query(
    `UPDATE scheduled_slots
     SET status = $1,
         completed_at = COALESCE($2, completed_at),
         updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [status, completedAt, slotId, userId]
  );
  return rows[0] || null;
};

// Insert a single rescheduled slot
const insertRescheduledSlot = async (
  sprintId, taskId, userId, scheduledDate, startTime, endTime, reason
) => {
  const { rows } = await query(
    `INSERT INTO scheduled_slots
       (sprint_id, task_id, user_id, scheduled_date, start_time, end_time,
        status, is_locked, recommendation_reason)
     VALUES ($1,$2,$3,$4,$5,$6,'scheduled', false, $7)
     RETURNING *`,
    [sprintId, taskId, userId, scheduledDate, startTime, endTime, reason]
  );
  return rows[0];
};

// Get all used slots for a user in a date range (for free slot calculation)
const getUsedSlotsForRange = async (userId, fromDate, toDate) => {
  const { rows } = await query(
    `SELECT scheduled_date, start_time, end_time
     FROM scheduled_slots
     WHERE user_id = $1
       AND scheduled_date BETWEEN $2 AND $3
       AND status NOT IN ('missed', 'skipped')`,
    [userId, fromDate, toDate]
  );
  return rows;
};
module.exports = {
  createSprint, insertSlots, updateSprintPlannedMinutes,
  getSprintByWeek, getSprintWithTasks, acceptSprint,
  lockSlot, deleteSprintSlots, getSlotById, getSlotsByTask, updateSlotStatus, insertRescheduledSlot, getUsedSlotsForRange
};

