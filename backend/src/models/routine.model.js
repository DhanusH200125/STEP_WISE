// backend/src/models/routine.model.js
const { query } = require('../config/db');

// ── Sleep Schedule ──────────────────────────────────────────

const upsertSleepSchedule = async (userId, sleepTime, wakeTime) => {
  const { rows } = await query(
    `INSERT INTO sleep_schedules (user_id, sleep_time, wake_time)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
     SET sleep_time = $2, wake_time = $3, updated_at = NOW()
     RETURNING *`,
    [userId, sleepTime, wakeTime]
  );
  return rows[0];
};

const getSleepSchedule = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM sleep_schedules WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
};

// ── Routine Blocks ──────────────────────────────────────────

const createBlock = async (userId, { title, dayOfWeek, startTime, endTime }) => {
  const { rows } = await query(
    `INSERT INTO routine_blocks (user_id, title, day_of_week, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, title, dayOfWeek, startTime, endTime]
  );
  return rows[0];
};

const getBlocks = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM routine_blocks
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY day_of_week, start_time`,
    [userId]
  );
  return rows;
};

const getBlockById = async (id, userId) => {
  const { rows } = await query(
    `SELECT * FROM routine_blocks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
};

const updateBlock = async (id, userId, { title, dayOfWeek, startTime, endTime }) => {
  const { rows } = await query(
    `UPDATE routine_blocks
     SET title = COALESCE($3, title),
         day_of_week = COALESCE($4, day_of_week),
         start_time = COALESCE($5, start_time),
         end_time = COALESCE($6, end_time),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, title, dayOfWeek, startTime, endTime]
  );
  return rows[0] || null;
};

const deleteBlock = async (id, userId) => {
  const { rows } = await query(
    `UPDATE routine_blocks SET is_active = FALSE
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId]
  );
  return rows[0] || null;
};

// ── Overlap Detection ───────────────────────────────────────
// Returns any existing blocks that overlap with the proposed time slot
const findOverlappingBlocks = async (userId, dayOfWeek, startTime, endTime, excludeId = null) => {
  const { rows } = await query(
    `SELECT * FROM routine_blocks
     WHERE user_id = $1
       AND day_of_week = $2
       AND is_active = TRUE
       AND id != COALESCE($5, '00000000-0000-0000-0000-000000000000'::uuid)
       AND (start_time, end_time) OVERLAPS ($3::time, $4::time)`,
    [userId, dayOfWeek, startTime, endTime, excludeId]
  );
  return rows;
};

module.exports = {
  upsertSleepSchedule,
  getSleepSchedule,
  createBlock,
  getBlocks,
  getBlockById,
  updateBlock,
  deleteBlock,
  findOverlappingBlocks,
};