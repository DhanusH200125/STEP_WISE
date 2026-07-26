// backend/src/services/analytics.service.js
const { query } = require('../config/db');
const { getLogsForWeek, getCompletionPatternByHour } = require('../models/log.model');
const { getGrowthReport } = require('./growth.service');

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const getDayName = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00Z');
  return DAYS[d.getUTCDay()];
};

// ── Weekly Report ────────────────────────────────────────────

const generateWeeklyReport = async (userId, weekStart) => {
  const weekEnd = new Date(weekStart + 'T12:00:00Z');
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // Get sprint for this week
  const { rows: sprintRows } = await query(
    `SELECT * FROM weekly_sprints
     WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStart]
  );
  const sprint = sprintRows[0] || null;

  if (!sprint) {
    return { error: 'No sprint found for this week. Generate a sprint first.' };
  }

  // ── Slot stats ───────────────────────────────────────────
  const { rows: slotStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'missed')    AS missed,
       COUNT(*) FILTER (WHERE status = 'skipped')   AS skipped,
       COUNT(*) FILTER (WHERE status = 'rescheduled') AS rescheduled,
       COUNT(*) AS total
     FROM scheduled_slots
     WHERE sprint_id = $1`,
    [sprint.id]
  );
  const slots = slotStats[0];
  const completionRate = slots.total > 0
    ? Math.round((slots.completed / slots.total) * 100)
    : 0;

  // ── Minutes by domain ────────────────────────────────────
  const { rows: domainRows } = await query(
    `SELECT
       t.domain,
       SUM(EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60) AS planned_minutes,
       SUM(CASE WHEN sl.status = 'completed'
           THEN EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60
           ELSE 0 END) AS completed_minutes
     FROM scheduled_slots sl
     JOIN tasks t ON t.id = sl.task_id
     WHERE sl.sprint_id = $1
     GROUP BY t.domain`,
    [sprint.id]
  );

  const minutesByDomain = {};
  for (const row of domainRows) {
    minutesByDomain[row.domain] = {
      plannedMinutes: Math.round(parseFloat(row.planned_minutes)),
      completedMinutes: Math.round(parseFloat(row.completed_minutes)),
    };
  }

  // ── Productivity patterns (best hours from logs) ─────────
  const { rows: hourRows } = await query(
    `SELECT
       EXTRACT(HOUR FROM created_at) AS hour,
       COUNT(*) AS completions
     FROM activity_logs
     WHERE user_id = $1
       AND event_type = 'slot_completed'
       AND created_at BETWEEN $2 AND $3
     GROUP BY hour
     ORDER BY completions DESC`,
    [userId, weekStart, weekEndStr]
  );

  const productivityByHour = hourRows.reduce((acc, row) => {
    const hour = parseInt(row.hour);
    const label = hour < 12 ? `${hour}:00 AM`
                : hour === 12 ? '12:00 PM'
                : `${hour - 12}:00 PM`;
    acc[label] = parseInt(row.completions);
    return acc;
  }, {});

  const bestHour = hourRows[0]
    ? `${parseInt(hourRows[0].hour)}:00`
    : 'Not enough data yet';

  // ── Task completion details ───────────────────────────────
  const { rows: taskRows } = await query(
    `SELECT
       t.id, t.title, t.domain, t.priority, t.estimated_minutes,
       t.actual_minutes, t.status as task_status,
       COUNT(sl.id) AS total_slots,
       COUNT(sl.id) FILTER (WHERE sl.status = 'completed') AS completed_slots,
       COUNT(sl.id) FILTER (WHERE sl.status = 'missed') AS missed_slots
     FROM scheduled_slots sl
     JOIN tasks t ON t.id = sl.task_id
     WHERE sl.sprint_id = $1
     GROUP BY t.id`,
    [sprint.id]
  );

  // ── Actual vs estimated time variance ───────────────────
  const { rows: varianceRows } = await query(
    `SELECT
       AVG(CAST(metadata->>'variance' AS NUMERIC)) AS avg_variance,
       COUNT(*) AS completed_count
     FROM activity_logs
     WHERE user_id = $1
       AND event_type = 'task_completed'
       AND created_at BETWEEN $2 AND $3`,
    [userId, weekStart, weekEndStr]
  );
  const variance = varianceRows[0];

  // ── Growth this week ─────────────────────────────────────
  const growthDomain = minutesByDomain['personal_growth'] || {
    plannedMinutes: 0,
    completedMinutes: 0,
  };

  // ── Generate suggestions ─────────────────────────────────
  const suggestions = [];

  if (completionRate < 50) {
    suggestions.push('Completion rate is low this week. Consider reducing your sprint size next week.');
  }
  if (completionRate >= 80) {
    suggestions.push('Great week! You could increase your capacity target slightly next sprint.');
  }
  if (parseInt(slots.missed) > 2) {
    suggestions.push(`You missed ${slots.missed} slots. Review your routine blocks — you may be over-scheduling.`);
  }
  if (growthDomain.completedMinutes < growthDomain.plannedMinutes * 0.5) {
    suggestions.push('Growth tasks are falling behind. Try locking them at the start of your sprint.');
  }
  if (bestHour !== 'Not enough data yet') {
    suggestions.push(`Your most productive hour is around ${bestHour}. Schedule high-energy tasks then.`);
  }
  if (parseFloat(variance?.avg_variance || 0) > 15) {
    suggestions.push('Your tasks are consistently taking longer than estimated. Try adding 20% buffer to estimates.');
  }

  // ── Save report to DB ─────────────────────────────────────
  await query(
    `INSERT INTO weekly_reports
       (user_id, sprint_id, week_start, tasks_planned, tasks_completed,
        tasks_missed, completion_rate, minutes_by_domain,
        growth_minutes_planned, growth_minutes_completed,
        productivity_patterns, suggestions)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (sprint_id) DO UPDATE SET
       tasks_completed = $5, tasks_missed = $6,
       completion_rate = $7, minutes_by_domain = $8,
       growth_minutes_completed = $10,
       productivity_patterns = $11, suggestions = $12,
       generated_at = NOW()`,
    [
      userId, sprint.id, weekStart,
      parseInt(slots.total), parseInt(slots.completed),
      parseInt(slots.missed), completionRate,
      JSON.stringify(minutesByDomain),
      growthDomain.plannedMinutes, growthDomain.completedMinutes,
      JSON.stringify(productivityByHour),
      JSON.stringify(suggestions),
    ]
  );

  return {
    weekStart,
    weekEnd: weekEndStr,
    sprint: {
      id: sprint.id,
      status: sprint.status,
      capacityMinutes: sprint.computed_capacity_minutes,
      plannedMinutes: sprint.planned_minutes,
    },
    slots: {
      total: parseInt(slots.total),
      completed: parseInt(slots.completed),
      missed: parseInt(slots.missed),
      skipped: parseInt(slots.skipped),
      rescheduled: parseInt(slots.rescheduled),
      completionRate,
    },
    minutesByDomain,
    productivity: {
      bestHour,
      byHour: productivityByHour,
      avgVarianceMinutes: Math.round(parseFloat(variance?.avg_variance || 0)),
    },
    growth: {
      plannedMinutes: growthDomain.plannedMinutes,
      completedMinutes: growthDomain.completedMinutes,
    },
    tasks: taskRows,
    suggestions,
  };
};

// ── All-time Summary ─────────────────────────────────────────

const getAllTimeSummary = async (userId) => {
  // Overall task stats
  const { rows: taskStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'skipped')   AS skipped,
       COUNT(*) AS total,
       COALESCE(SUM(actual_minutes) FILTER (WHERE status = 'completed'), 0) AS total_actual_minutes,
       COALESCE(SUM(estimated_minutes) FILTER (WHERE status = 'completed'), 0) AS total_estimated_minutes
     FROM tasks WHERE user_id = $1`,
    [userId]
  );
  const tasks = taskStats[0];

  // Completion by domain
  const { rows: domainStats } = await query(
    `SELECT domain,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) AS total
     FROM tasks WHERE user_id = $1
     GROUP BY domain ORDER BY completed DESC`,
    [userId]
  );

  // Sprint stats
  const { rows: sprintStats } = await query(
    `SELECT
       COUNT(*) AS total_sprints,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed_sprints,
       COALESCE(AVG(planned_minutes), 0) AS avg_planned_minutes
     FROM weekly_sprints WHERE user_id = $1`,
    [userId]
  );

  // Best productivity hour all time
  const hourPatterns = await getCompletionPatternByHour(userId);
  const bestHourAllTime = hourPatterns.length > 0
    ? `${hourPatterns[0].hour}:00`
    : 'Not enough data';

  // Current streak (consecutive weeks with >50% completion)
  const { rows: recentReports } = await query(
    `SELECT week_start, completion_rate
     FROM weekly_reports
     WHERE user_id = $1
     ORDER BY week_start DESC
     LIMIT 12`,
    [userId]
  );

  let streak = 0;
  for (const report of recentReports) {
    if (parseFloat(report.completion_rate) >= 50) streak++;
    else break;
  }

  return {
    tasks: {
      total: parseInt(tasks.total),
      completed: parseInt(tasks.completed),
      skipped: parseInt(tasks.skipped),
      completionRate: tasks.total > 0
        ? Math.round((tasks.completed / tasks.total) * 100)
        : 0,
      totalMinutesTracked: Math.round(parseFloat(tasks.total_actual_minutes)),
      avgVarianceMinutes: tasks.total_estimated_minutes > 0
        ? Math.round(
            (parseFloat(tasks.total_actual_minutes) - parseFloat(tasks.total_estimated_minutes))
            / parseInt(tasks.completed || 1)
          )
        : 0,
    },
    byDomain: domainStats.map(d => ({
      domain: d.domain,
      completed: parseInt(d.completed),
      total: parseInt(d.total),
      completionRate: d.total > 0
        ? Math.round((d.completed / d.total) * 100)
        : 0,
    })),
    sprints: {
      total: parseInt(sprintStats[0].total_sprints),
      completed: parseInt(sprintStats[0].completed_sprints),
      avgPlannedMinutesPerWeek: Math.round(parseFloat(sprintStats[0].avg_planned_minutes)),
    },
    productivity: {
      bestHourAllTime,
      currentStreakWeeks: streak,
    },
  };
};

module.exports = { generateWeeklyReport, getAllTimeSummary };