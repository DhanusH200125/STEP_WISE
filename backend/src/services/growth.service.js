// backend/src/services/growth.service.js
const { query } = require('../config/db');
const { findUserWithPreferences } = require('../models/user.model');

const WEEKS_TO_CHECK = 4; // look back 4 weeks for consistency score

// ── Helpers ──────────────────────────────────────────────────

// Get monday of a given date's week
const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // adjust for Sunday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
};

// Get week start N weeks ago
const getWeekStartNWeeksAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n * 7);
  return getWeekStart(d);
};

// ── Growth minutes per week ───────────────────────────────────

const getGrowthMinutesForWeek = async (userId, weekStart, weekEnd) => {
  // Planned growth minutes (tasks in sprint slots that week)
  const { rows: planned } = await query(
    `SELECT COALESCE(SUM(
       EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60
     ), 0) AS minutes
     FROM scheduled_slots sl
     JOIN tasks t ON t.id = sl.task_id
     WHERE sl.user_id = $1
       AND t.domain = 'personal_growth'
       AND sl.scheduled_date BETWEEN $2 AND $3`,
    [userId, weekStart, weekEnd]
  );

  // Completed growth minutes (slots marked completed that week)
  const { rows: completed } = await query(
    `SELECT COALESCE(SUM(
       EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60
     ), 0) AS minutes
     FROM scheduled_slots sl
     JOIN tasks t ON t.id = sl.task_id
     WHERE sl.user_id = $1
       AND t.domain = 'personal_growth'
       AND sl.status = 'completed'
       AND sl.scheduled_date BETWEEN $2 AND $3`,
    [userId, weekStart, weekEnd]
  );

  return {
    plannedMinutes: Math.round(parseFloat(planned[0].minutes)),
    completedMinutes: Math.round(parseFloat(completed[0].minutes)),
  };
};

// ── Consistency score ────────────────────────────────────────
// % of weeks in the last N weeks where user met their growth target

const computeConsistencyScore = async (userId, targetMinutesPerWeek) => {
  const weekResults = [];

  for (let i = 1; i <= WEEKS_TO_CHECK; i++) {
    const weekStart = getWeekStartNWeeksAgo(i);
    const weekEnd = new Date(weekStart + 'T12:00:00Z');
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const { completedMinutes } = await getGrowthMinutesForWeek(userId, weekStart, weekEndStr);
    const metTarget = completedMinutes >= targetMinutesPerWeek;

    weekResults.push({
      weekStart,
      completedMinutes,
      targetMinutes: targetMinutesPerWeek,
      metTarget,
    });
  }

  const weeksMetTarget = weekResults.filter(w => w.metTarget).length;
  const consistencyScore = Math.round((weeksMetTarget / WEEKS_TO_CHECK) * 100);

  return { consistencyScore, weekResults, weeksMetTarget };
};

// ── Generate suggestions ──────────────────────────────────────

const generateSuggestions = (consistencyScore, currentWeek, targetMinutes, isOverloaded) => {
  const suggestions = [];

  if (isOverloaded) {
    const reducedTarget = Math.round(targetMinutes * 0.5);
    suggestions.push({
      type: 'overload_reduction',
      message: `This week looks packed. Consider a reduced growth target of ${reducedTarget} min (50%) to stay consistent without burning out.`,
      actionable: true,
    });
  }

  if (consistencyScore < 50) {
    suggestions.push({
      type: 'protect_growth_slots',
      message: `Your growth consistency is at ${consistencyScore}% over the last ${WEEKS_TO_CHECK} weeks. Try locking 1-2 growth slots at the start of your sprint so they don't get pushed out.`,
      actionable: true,
    });
    suggestions.push({
      type: 'increase_weight',
      message: 'Growth tasks will be prioritized higher in your next sprint to help rebuild consistency.',
      actionable: false,
    });
  } else if (consistencyScore < 75) {
    suggestions.push({
      type: 'consistency_nudge',
      message: `You're at ${consistencyScore}% consistency — good progress! Try to protect at least ${Math.round(targetMinutes / 60 * 10) / 10} hours for growth this week.`,
      actionable: true,
    });
  } else {
    suggestions.push({
      type: 'on_track',
      message: `Great job! You're hitting your growth target ${consistencyScore}% of the time. Keep it up!`,
      actionable: false,
    });
  }

  if (currentWeek.completedMinutes < currentWeek.plannedMinutes) {
    const deficit = currentWeek.plannedMinutes - currentWeek.completedMinutes;
    suggestions.push({
      type: 'current_week_deficit',
      message: `You're ${deficit} min behind on growth tasks this week. Can you find a slot before the week ends?`,
      actionable: true,
    });
  }

  return suggestions;
};

// ── Main: Get full growth report ─────────────────────────────

const getGrowthReport = async (userId) => {
  const user = await findUserWithPreferences(userId);
  const targetHours = parseFloat(user?.growth_target_hours_weekly || 5);
  const targetMinutes = Math.round(targetHours * 60);

  // Current week
  const thisWeekStart = getWeekStart();
  const thisWeekEnd = new Date(thisWeekStart + 'T12:00:00Z');
  thisWeekEnd.setUTCDate(thisWeekEnd.getUTCDate() + 6);
  const thisWeekEndStr = thisWeekEnd.toISOString().split('T')[0];

  const currentWeek = await getGrowthMinutesForWeek(userId, thisWeekStart, thisWeekEndStr);

  // Consistency over last N weeks
  const { consistencyScore, weekResults, weeksMetTarget } =
    await computeConsistencyScore(userId, targetMinutes);

  // Check if current week is overloaded
  // (planned minutes > 90% of capacity — simple heuristic)
  const { rows: sprintRows } = await query(
    `SELECT planned_minutes, computed_capacity_minutes
     FROM weekly_sprints
     WHERE user_id = $1 AND week_start = $2`,
    [userId, thisWeekStart]
  );

  const isOverloaded = sprintRows.length > 0
    ? (sprintRows[0].planned_minutes / sprintRows[0].computed_capacity_minutes) > 0.9
    : false;

  const suggestions = generateSuggestions(
    consistencyScore, currentWeek, targetMinutes, isOverloaded
  );

  // Backlog growth tasks not yet scheduled
  const { rows: pendingTasks } = await query(
    `SELECT id, title, estimated_minutes, priority
     FROM tasks
     WHERE user_id = $1
       AND domain = 'personal_growth'
       AND status = 'backlog'
     ORDER BY priority DESC`,
    [userId]
  );

  return {
    target: {
      weeklyHours: targetHours,
      weeklyMinutes: targetMinutes,
    },
    currentWeek: {
      weekStart: thisWeekStart,
      ...currentWeek,
      completionRate: currentWeek.plannedMinutes > 0
        ? Math.round((currentWeek.completedMinutes / currentWeek.plannedMinutes) * 100)
        : 0,
      remainingMinutes: Math.max(0, targetMinutes - currentWeek.completedMinutes),
    },
    consistency: {
      score: consistencyScore,
      weeksMetTarget,
      weeksChecked: WEEKS_TO_CHECK,
      weekBreakdown: weekResults,
      status: consistencyScore >= 75 ? 'on_track'
            : consistencyScore >= 50 ? 'needs_attention'
            : 'at_risk',
    },
    suggestions,
    pendingGrowthTasks: pendingTasks,
  };
};

module.exports = { getGrowthReport };