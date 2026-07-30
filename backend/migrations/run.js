// backend/migrations/run.js
// Run: node migrations/run.js
// Runs all SQL migrations in order. Skips already-applied ones.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  await client.connect();

  // Create migrations tracker table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get already-applied migrations
  const { rows: applied } = await client.query('SELECT filename FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  // Read SQL files in order
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetical = numeric order (001, 002, ...)

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭  Skipping ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(` Applied ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(` Failed on ${file}:`, err.message);
      process.exit(1);
    }
  }

  if (ran === 0) {
    console.log(' All migrations already up to date.');
  } else {
    console.log(`\n  Done. Applied ${ran} migration(s).`);
  }

  await client.end();
}

runMigrations().catch(err => {
  console.error('Migration runner error:', err);
  process.exit(1);
});