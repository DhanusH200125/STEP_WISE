// backend/src/models/task.model.js
const { query } = require('../config/db');

// const createTask = async (userId, fields) => {
//   const {
//     title, description, domain, priority,
//     estimatedMinutes, energyLevel, deadline, deadlineType,
//   } = fields;

//   const { rows } = await query(
//     `INSERT INTO tasks
//        (user_id, title, description, domain, priority, estimated_minutes, energy_level, deadline, deadline_type)
//      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
//      RETURNING *`,
//     [userId, title, description || null, domain, priority || 'medium',
//      estimatedMinutes, energyLevel || 'medium', deadline || null, deadlineType || null]
//   );
//   return rows[0];
// };

const createTask = async (userId, fields) => {
  const {
    title, description, domain, priority,
    estimatedMinutes, energyLevel, deadline, deadlineType,
    preferredDate, preferredStartTime, preferredEndTime,
  } = fields;

  const isTimeHinted = !!(preferredDate && preferredStartTime && preferredEndTime);

  const { rows } = await query(
    `INSERT INTO tasks
       (user_id, title, description, domain, priority, estimated_minutes,
        energy_level, deadline, deadline_type,
        preferred_date, preferred_start_time, preferred_end_time, is_time_hinted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      userId, title, description || null, domain, priority || 'medium',
      estimatedMinutes, energyLevel || 'medium', deadline || null, deadlineType || null,
      preferredDate || null, preferredStartTime || null, preferredEndTime || null, isTimeHinted,
    ]
  );
  return rows[0];
};

const getTasks = async (userId, filters = {}) => {
  const conditions = ['user_id = $1'];
  const values = [userId];
  let i = 2;

  if (filters.status) {
    conditions.push(`status = $${i++}`);
    values.push(filters.status);
  }
  if (filters.domain) {
    conditions.push(`domain = $${i++}`);
    values.push(filters.domain);
  }
  if (filters.priority) {
    conditions.push(`priority = $${i++}`);
    values.push(filters.priority);
  }

  const { rows } = await query(
    `SELECT * FROM tasks
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE priority
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       deadline ASC NULLS LAST,
       created_at DESC`,
    values
  );
  return rows;
};

const getTaskById = async (id, userId) => {
  const { rows } = await query(
    `SELECT * FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
};

const updateTask = async (id, userId, fields) => {
  const allowed = [
    'title', 'description', 'domain', 'priority', 'status',
    'estimated_minutes', 'energy_level', 'deadline', 'deadline_type', 'is_locked'
  ];

  const updates = [];
  const values = [];
  let i = 1;

  const colMap = {
    title: 'title', description: 'description', domain: 'domain',
    priority: 'priority', status: 'status',
    estimatedMinutes: 'estimated_minutes', energyLevel: 'energy_level',
    deadline: 'deadline', deadlineType: 'deadline_type', isLocked: 'is_locked',
    preferredDate: 'preferred_date',
    preferredStartTime: 'preferred_start_time',
    preferredEndTime: 'preferred_end_time',
    isTimeHinted: 'is_time_hinted',
  };

  for (const [jsKey, col] of Object.entries(colMap)) {
    if (fields[jsKey] !== undefined) {
      updates.push(`${col} = $${i++}`);
      values.push(fields[jsKey]);
    }
  }

  if (updates.length === 0) return null;

  // Auto-set completed_at when status = completed
  if (fields.status === 'completed') {
    updates.push(`completed_at = NOW()`);
    if (fields.actualMinutes) {
      updates.push(`actual_minutes = $${i++}`);
      values.push(fields.actualMinutes);
    }
  }

  values.push(id, userId);
  const { rows } = await query(
    `UPDATE tasks SET ${updates.join(', ')}
     WHERE id = $${i++} AND user_id = $${i++}
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

const deleteTask = async (id, userId) => {
  const { rows } = await query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows[0] || null;
};

module.exports = { createTask, getTasks, getTaskById, updateTask, deleteTask };