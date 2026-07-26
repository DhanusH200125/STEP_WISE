// backend/src/models/log.model.js
const { query } = require('../config/db');

/**
 * Append a new activity log entry (never update, never delete)
 */
const log = async (userId, eventType, { taskId, slotId, sprintId, metadata } = {}) => {
  const { rows } = await query(
    `INSERT INTO activity_logs (user_id, event_type, task_id, slot_id, sprint_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, event_type, created_at`,
    [userId, eventType, taskId || null, slotId || null, sprintId || null, metadata || {}]
  );
  return rows[0];
};

/**
 * Get recent logs for a user
 */
const getLogs = async (userId, { limit = 50, eventType, taskId } = {}) => {
  const conditions = ['user_id = $1'];
  const values = [userId];
  let i = 2;

  if (eventType) {
    conditions.push(`event_type = $${i++}`);
    values.push(eventType);
  }
  if (taskId) {
    conditions.push(`task_id = $${i++}`);
    values.push(taskId);
  }

  values.push(limit);
  const { rows } = await query(
    `SELECT * FROM activity_logs
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${i}`,
    values
  );
  return rows;
};

/**
 * Get logs for a specific week (for analytics)
 */
const getLogsForWeek = async (userId, weekStart, weekEnd) => {
  const { rows } = await query(
    `SELECT * FROM activity_logs
     WHERE user_id = $1
       AND created_at >= $2::date
       AND created_at < ($3::date + INTERVAL '1 day')
     ORDER BY created_at ASC`,
    [userId, weekStart, weekEnd]
  );
  return rows;
};

/**
 * Get completion pattern by hour (used in analytics FR-11)
 * Returns how many tasks were completed in each hour of day
 */
const getCompletionPatternByHour = async (userId) => {
  const { rows } = await query(
    `SELECT
       EXTRACT(HOUR FROM created_at) AS hour,
       COUNT(*) AS completions
     FROM activity_logs
     WHERE user_id = $1 AND event_type = 'slot_completed'
     GROUP BY hour
     ORDER BY hour`,
    [userId]
  );
  return rows;
};

module.exports = { log, getLogs, getLogsForWeek, getCompletionPatternByHour };