// backend/src/models/user.model.js
const { query } = require('../config/db');

/**
 * Create a new user and their default preferences in a single transaction
 */
const createUser = async (client, { email, passwordHash, fullName, role, timezone }) => {
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role, timezone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, full_name, role, timezone, created_at`,
    [email, passwordHash, fullName, role, timezone || 'UTC']
  );
  return rows[0];
};

/**
 * Create default preferences for a new user
 */
const createDefaultPreferences = async (client, userId) => {
  const { rows } = await client.query(
    `INSERT INTO user_preferences (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  );
  return rows[0];
};

/**
 * Find user by email (includes password_hash for login)
 */
const findUserByEmail = async (email) => {
  const { rows } = await query(
    `SELECT id, email, password_hash, full_name, role, timezone, created_at
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
};

/**
 * Find user by ID (no password hash)
 */
const findUserById = async (id) => {
  const { rows } = await query(
    `SELECT id, email, full_name, role, timezone, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Get user with their preferences
 */
const findUserWithPreferences = async (id) => {
  const { rows } = await query(
    `SELECT
       u.id, u.email, u.full_name, u.role, u.timezone, u.created_at,
       p.working_days, p.notification_pref, p.growth_target_hours_weekly,
       p.quiet_hours_start, p.quiet_hours_end, p.realism_factor
     FROM users u
     LEFT JOIN user_preferences p ON p.user_id = u.id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Update user preferences
 */
const updatePreferences = async (userId, fields) => {
  const allowed = [
    'working_days', 'notification_pref', 'growth_target_hours_weekly',
    'quiet_hours_start', 'quiet_hours_end', 'realism_factor'
  ];

  const updates = [];
  const values = [];
  let i = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }

  if (updates.length === 0) return null;

  values.push(userId);
  const { rows } = await query(
    `UPDATE user_preferences SET ${updates.join(', ')}
     WHERE user_id = $${i}
     RETURNING *`,
    values
  );
  return rows[0];
};

module.exports = {
  createUser,
  createDefaultPreferences,
  findUserByEmail,
  findUserById,
  findUserWithPreferences,
  updatePreferences,
};