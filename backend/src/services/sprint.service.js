// backend/src/services/sprint.service.js
const { computeCapacity } = require('./capacity.service');
const { getTasks } = require('../models/task.model');
const { getSleepSchedule, getBlocks } = require('../models/routine.model');
const { findUserWithPreferences } = require('../models/user.model');
const {
  createSprint, insertSlots, updateSprintPlannedMinutes, deleteSprintSlots,
} = require('../models/sprint.model');
const { getClient } = require('../config/db');

const SLOT_SIZE = 30;
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// ── Helpers ──────────────────────────────────────────────────

const timeToMins = (t) => {
  const str = typeof t === 'string' ? t : String(t);
  const [h, m] = str.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

const minsToTime = (m) => {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
};

const getWeekDates = (weekStart) => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T12:00:00Z');
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const getDayName = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00Z');
  return DAYS[d.getUTCDay()];
};

// ── Build blocked ranges per day ─────────────────────────────

const buildBlockedRanges = (sleepSchedule, routineBlocks, weekDates) => {
  const blocked = {};
  for (const date of weekDates) {
    blocked[date] = [];
    const dayName = getDayName(date);

    if (sleepSchedule) {
      const sleepMins = timeToMins(sleepSchedule.sleep_time);
      const wakeMins = timeToMins(sleepSchedule.wake_time);
      if (wakeMins > sleepMins) {
        blocked[date].push({ start: sleepMins, end: wakeMins });
      } else {
        blocked[date].push({ start: sleepMins, end: 24 * 60 });
        blocked[date].push({ start: 0, end: wakeMins });
      }
    }

    const dayBlocks = routineBlocks.filter(b => b.day_of_week === dayName);
    for (const b of dayBlocks) {
      blocked[date].push({
        start: timeToMins(b.start_time),
        end: timeToMins(b.end_time),
      });
    }
  }
  return blocked;
};

// ── Check if a single 30-min slot is free ───────────────────

const isSlotFree = (date, startMins, endMins, blockedRanges, usedSlots) => {
  for (const r of (blockedRanges[date] || [])) {
    if (startMins < r.end && endMins > r.start) return false;
  }
  for (const s of (usedSlots[date] || [])) {
    if (startMins < s.end && endMins > s.start) return false;
  }
  return true;
};

// ── Find consecutive free slots for a task on a given day ───
// Returns starting minute if found, null if not enough consecutive slots

const findConsecutiveSlots = (date, slotsNeeded, blockedRanges, usedSlots) => {
  const wakeMins = (() => {
    const wake = (blockedRanges[date] || []).find(r => r.start === 0);
    return wake ? wake.end : 6 * 60; // default start 6am
  })();

  let startSearch = wakeMins;

  while (startSearch + (slotsNeeded * SLOT_SIZE) <= 24 * 60) {
    let allFree = true;

    for (let i = 0; i < slotsNeeded; i++) {
      const slotStart = startSearch + i * SLOT_SIZE;
      const slotEnd = slotStart + SLOT_SIZE;
      if (!isSlotFree(date, slotStart, slotEnd, blockedRanges, usedSlots)) {
        // Jump past this blocker
        startSearch = slotEnd;
        allFree = false;
        break;
      }
    }

    if (allFree) return startSearch; // Found a valid consecutive window
  }

  return null; // No room on this day
};

// ── Find first working day with enough consecutive slots ─────

const findDayWithConsecutiveSlots = (slotsNeeded, weekDates, workingDays, blockedRanges, usedSlots) => {
  for (const date of weekDates) {
    if (!workingDays.includes(getDayName(date))) continue;
    const startMins = findConsecutiveSlots(date, slotsNeeded, blockedRanges, usedSlots);
    if (startMins !== null) return { date, startMins };
  }
  return null; // No day has enough consecutive free slots this week
};

// ── Explainability reason ────────────────────────────────────

const getReason = (task, startMins) => {
  const reasons = [];
  const timeOfDay = startMins < 12*60 ? 'morning' : startMins < 17*60 ? 'afternoon' : 'evening';

  if (task.deadline_type === 'hard') {
    const daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / 86400000);
    reasons.push(`Hard deadline in ${daysLeft} day(s)`);
  }
  if (task.priority === 'critical') reasons.push('Critical priority');
  else if (task.priority === 'high') reasons.push('High priority');

  if (task.energy_level === 'high' && timeOfDay === 'morning')
    reasons.push('High-energy task in morning peak');
  if (task.energy_level === 'low' && timeOfDay === 'afternoon')
    reasons.push('Low-energy task in afternoon');
  if (task.is_time_hinted)
    reasons.push('Scheduled at your preferred time');

  return reasons.join(' · ') || 'Fits available capacity';
};

// ── Main Sprint Generator ────────────────────────────────────

const generateSprint = async (userId, weekStart) => {
  const weekStartDate = new Date(weekStart + 'T12:00:00Z');
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = weekEndDate.toISOString().split('T')[0];
  const weekDates = getWeekDates(weekStart);

  const [capacity, tasks, sleep, routineBlocks, user] = await Promise.all([
    computeCapacity(userId),
    getTasks(userId, { status: 'backlog' }),
    getSleepSchedule(userId),
    getBlocks(userId),
    findUserWithPreferences(userId),
  ]);

  const workingDays = user?.working_days || ['monday','tuesday','wednesday','thursday','friday'];
  const blockedRanges = buildBlockedRanges(sleep, routineBlocks, weekDates);
  const usedSlots = {};
  weekDates.forEach(d => usedSlots[d] = []);

  const slotsToInsert = [];
  let totalPlannedMinutes = 0;
  const capacityLimit = capacity.productiveCapacityMinutes;
  const unscheduledTasks = []; // tasks that couldn't fit

  // ── Phase 1: Time-hinted tasks (user chose exact time) ──────
  const hintedTasks = tasks.filter(t => t.is_time_hinted);
  const flexibleTasks = tasks.filter(t => !t.is_time_hinted);

  for (const task of hintedTasks) {
    const taskDate = task.preferred_date
      ? new Date(task.preferred_date).toISOString().split('T')[0]
      : null;

    if (!taskDate || !weekDates.includes(taskDate)) continue;

    const startMins = timeToMins(task.preferred_start_time);
    const endMins = timeToMins(task.preferred_end_time);
    const duration = endMins - startMins;

    const conflict = !isSlotFree(taskDate, startMins, endMins, blockedRanges, usedSlots);

    if (!conflict) {
      // Mark all 30-min sub-slots as used
      for (let m = startMins; m < endMins; m += SLOT_SIZE) {
        usedSlots[taskDate].push({ start: m, end: m + SLOT_SIZE });
      }
      totalPlannedMinutes += duration;
    }

    slotsToInsert.push({
      taskId: task.id,
      scheduledDate: taskDate,
      startTime: minsToTime(startMins),
      endTime: minsToTime(endMins),
      isLocked: true,
      recommendationReason: conflict
        ? '⚠️ Conflict with existing block — please review'
        : getReason(task, startMins),
    });
  }

  // ── Phase 2: Sort flexible tasks ────────────────────────────
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  flexibleTasks.sort((a, b) => {
    if (a.deadline_type === 'hard' && b.deadline_type !== 'hard') return -1;
    if (b.deadline_type === 'hard' && a.deadline_type !== 'hard') return 1;
    if (a.deadline && b.deadline) {
      const diff = new Date(a.deadline) - new Date(b.deadline);
      if (diff !== 0) return diff;
    }
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // ── Phase 3: Schedule flexible tasks as CONSECUTIVE blocks ──
  for (const task of flexibleTasks) {
    if (totalPlannedMinutes >= capacityLimit) break;

    // Round up to nearest 30-min slot
    const slotsNeeded = Math.ceil(task.estimated_minutes / SLOT_SIZE);
    const taskDurationMins = slotsNeeded * SLOT_SIZE;

    // Find a day with enough CONSECUTIVE free slots
    const found = findDayWithConsecutiveSlots(
      slotsNeeded, weekDates, workingDays, blockedRanges, usedSlots
    );

    if (!found) {
      // No room this week — flag it
      unscheduledTasks.push({ taskId: task.id, title: task.title, reason: 'No consecutive slot available this week' });
      continue;
    }

    const { date, startMins } = found;

    // Place all consecutive slots
    for (let i = 0; i < slotsNeeded; i++) {
      const slotStart = startMins + i * SLOT_SIZE;
      const slotEnd = slotStart + SLOT_SIZE;

      usedSlots[date].push({ start: slotStart, end: slotEnd });

      slotsToInsert.push({
        taskId: task.id,
        scheduledDate: date,
        startTime: minsToTime(slotStart),
        endTime: minsToTime(slotEnd),
        isLocked: false,
        // Only first slot gets the reason, rest are null
        recommendationReason: i === 0 ? getReason(task, startMins) : null,
      });
    }

    totalPlannedMinutes += taskDurationMins;
  }

  // ── Phase 4: Save to DB ──────────────────────────────────────
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sprint = await createSprint(
      client, userId, weekStart, weekEnd,
      capacity.productiveCapacityMinutes, capacity.realismFactor
    );

    await deleteSprintSlots(client, sprint.id);

    const fullSlots = slotsToInsert.map(s => ({ ...s, sprintId: sprint.id, userId }));
    const insertedSlots = await insertSlots(client, fullSlots);
    await updateSprintPlannedMinutes(client, sprint.id, totalPlannedMinutes);

    await client.query('COMMIT');

    return {
      sprint: { ...sprint, planned_minutes: totalPlannedMinutes },
      slots: insertedSlots,
      capacity,
      unscheduledTasks,
      summary: {
        tasksScheduled: [...new Set(slotsToInsert.map(s => s.taskId))].length,
        tasksUnscheduled: unscheduledTasks.length,
        totalSlots: insertedSlots.length,
        plannedMinutes: totalPlannedMinutes,
        plannedHours: +(totalPlannedMinutes / 60).toFixed(1),
        capacityUsedPercent: +((totalPlannedMinutes / capacity.productiveCapacityMinutes) * 100).toFixed(1),
        conflicts: slotsToInsert.filter(s => s.recommendationReason?.includes('⚠️')).length,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { generateSprint };