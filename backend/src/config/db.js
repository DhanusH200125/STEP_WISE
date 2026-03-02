// backend/src/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
  process.exit(1);
});

/**
 * Execute a query with optional parameters.
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool (for transactions).
 * Always call client.release() in a finally block.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };