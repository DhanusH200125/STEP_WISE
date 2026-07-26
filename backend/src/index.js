// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));  
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/routines', require('./routes/routine.routes'));
app.use('/api/tasks', require('./routes/task.routes'));
app.use('/api/sprints', require('./routes/sprint.routes'));
app.use('/api/reschedule', require('./routes/reschedule.routes'));
app.use('/api/growth', require('./routes/growth.routes'));
app.use('/api/logs', require('./routes/log.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));

// app.use('/api/routines',  require('./routes/routine.routes'));   // FR-3 (next)
// app.use('/api/tasks',     require('./routes/task.routes'));       // FR-5
// app.use('/api/sprints',   require('./routes/sprint.routes'));     // FR-6
// app.use('/api/analytics', require('./routes/analytics.routes')); // FR-11

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 STEPWISE API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;