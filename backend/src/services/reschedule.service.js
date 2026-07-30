// backend/src/services/reschedule.service.js
const { getSleepSchedule, getBlocks } = require('../models/routine.model');
const { getUsedSlotsForRange, getSlotsByTask } = require('../models/sprint.model');

const SLOT_SIZE = 30;
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// ── Helpers (same as sprint.service) ────────────────────────

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

const getDayName = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00Z');
  return DAYS[d.getUTCDay()];
};

// Generate next N days from a given date
const getNextDates = (fromDate, days = 7) => {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate + 'T12:00:00Z');
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

// ── Build blocked ranges ─────────────────────────────────────

const buildBlockedRanges = (sleepSchedule, routineBlocks, dates) => {
  const blocked = {};
  for (const date of dates) {
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

    routineBlocks
      .filter(b => b.day_of_week === dayName)
      .forEach(b => blocked[date].push({
        start: timeToMins(b.start_time),
        end: timeToMins(b.end_time),
      }));
  }
  return blocked;
};

// ── Check if a window is free ────────────────────────────────

const isWindowFree = (date, startMins, endMins, blockedRanges, usedSlots) => {
  for (const r of (blockedRanges[date] || [])) {
    if (startMins < r.end && endMins > r.start) return false;
  }
  for (const s of (usedSlots[date] || [])) {
    if (startMins < s.end && endMins > s.start) return false;
  }
  return true;
};

// ── Find consecutive free window ─────────────────────────────

const findConsecutiveWindow = (date, slotsNeeded, blockedRanges, usedSlots) => {
  const wakeMins = (() => {
    const wake = (blockedRanges[date] || []).find(r => r.start === 0);
    return wake ? wake.end : 6 * 60;
  })();

  let startSearch = wakeMins;
  while (startSearch + slotsNeeded * SLOT_SIZE <= 24 * 60) {
    let allFree = true;
    for (let i = 0; i < slotsNeeded; i++) {
      const s = startSearch + i * SLOT_SIZE;
      if (!isWindowFree(date, s, s + SLOT_SIZE, blockedRanges, usedSlots)) {
        startSearch = s + SLOT_SIZE;
        allFree = false;
        break;
      }
    }
    if (allFree) return startSearch;
  }
  return null;
};

// ── Main: Find reschedule options ────────────────────────────

/**
 * Given a missed/overflow slot, find up to 3 alternative time windows
 * starting from the next available date
 */
const findRescheduleOptions = async (userId, taskId, sprintId, slotsNeeded, fromDate) => {
  const [sleep, routineBlocks, usedSlotsRaw] = await Promise.all([
    getSleepSchedule(userId),
    getBlocks(userId),
    getUsedSlotsForRange(userId, fromDate, (() => {
      const d = new Date(fromDate + 'T12:00:00Z');
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    })()),
  ]);

  const dates = getNextDates(fromDate, 14); // Look 2 weeks ahead
  const blockedRanges = buildBlockedRanges(sleep, routineBlocks, dates);

  // Build used slots map from DB
  const usedSlots = {};
  dates.forEach(d => usedSlots[d] = []);
  for (const s of usedSlotsRaw) {
    const dateStr = new Date(s.scheduled_date).toISOString().split('T')[0];
    if (usedSlots[dateStr]) {
      usedSlots[dateStr].push({
        start: timeToMins(s.start_time),
        end: timeToMins(s.end_time),
      });
    }
  }

  const options = [];

  for (const date of dates) {
    if (options.length >= 3) break;

    const startMins = findConsecutiveWindow(date, slotsNeeded, blockedRanges, usedSlots);
    if (startMins === null) continue;

    const endMins = startMins + slotsNeeded * SLOT_SIZE;
    const timeOfDay = startMins < 12*60 ? 'morning' : startMins < 17*60 ? 'afternoon' : 'evening';

    options.push({
      date,
      startTime: minsToTime(startMins),
      endTime: minsToTime(endMins),
      durationMinutes: slotsNeeded * SLOT_SIZE,
      timeOfDay,
      reason: `${slotsNeeded * SLOT_SIZE} min window available in the ${timeOfDay}`,
    });

    // Mark as tentatively used so next option doesn't overlap
    for (let i = 0; i < slotsNeeded; i++) {
      usedSlots[date].push({
        start: startMins + i * SLOT_SIZE,
        end: startMins + (i + 1) * SLOT_SIZE,
      });
    }
  }

  return options;
};

// ── Overflow check ───────────────────────────────────────────

/**
 * When actual_minutes > estimated_minutes
 * Check if the next slot after the task is free
 * Returns: { canExtend, nextSlotFree, overflowMins, freedMins }
 */
const checkOverflow = async (userId, slot, actualMinutes) => {
  const estimatedMins = slot.estimated_minutes;
  const overflowMins = actualMinutes - estimatedMins;

  if (overflowMins <= 0) {
    // Finished early — calculate freed time
    const allocatedMins = timeToMins(slot.end_time) - timeToMins(slot.start_time);
    const freedMins = allocatedMins - actualMinutes;
    return { overflowMins: 0, freedMins: Math.max(0, freedMins), canExtend: false };
  }

  // Check if next 30-min slot is free
  const slotEndMins = timeToMins(slot.end_time);
  const nextSlotEnd = slotEndMins + SLOT_SIZE;
  const slotDate = new Date(slot.scheduled_date).toISOString().split('T')[0];

  const [sleep, routineBlocks, usedSlotsRaw] = await Promise.all([
    getSleepSchedule(userId),
    getBlocks(userId),
    getUsedSlotsForRange(userId, slotDate, slotDate),
  ]);

  const blockedRanges = buildBlockedRanges(sleep, routineBlocks, [slotDate]);
  const usedSlots = { [slotDate]: usedSlotsRaw.map(s => ({
    start: timeToMins(s.start_time),
    end: timeToMins(s.end_time),
  }))};

  const nextSlotFree = isWindowFree(slotDate, slotEndMins, nextSlotEnd, blockedRanges, usedSlots);

  return {
    overflowMins,
    freedMins: 0,
    canExtend: nextSlotFree,
    nextSlotDate: slotDate,
    nextSlotStart: minsToTime(slotEndMins),
    nextSlotEnd: minsToTime(nextSlotEnd),
  };
};

module.exports = { findRescheduleOptions, checkOverflow };