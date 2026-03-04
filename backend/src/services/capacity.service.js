// backend/src/services/capacity.service.js
const { getSleepSchedule, getBlocks } = require('../models/routine.model');
const { findUserWithPreferences } = require('../models/user.model');

const TOTAL_WEEK_MINUTES = 7 * 24 * 60; // 10,080

/**
 * Convert HH:MM time string to total minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Calculate sleep minutes per night (handles overnight sleep e.g. 23:00 - 07:00)
 */
const calcSleepMinutesPerNight = (sleepTime, wakeTime) => {
  const sleep = timeToMinutes(sleepTime);
  const wake = timeToMinutes(wakeTime);
  if (wake > sleep) return wake - sleep;           // same night (e.g. 22:00 - 06:00)
  return (24 * 60 - sleep) + wake;                 // crosses midnight
};

/**
 * Compute weekly productive capacity (FR-4)
 *
 * Formula:
 *   total_week  = 10,080 min
 * - sleep_total = sleep_per_night × 7
 * - committed   = sum of all active routine block durations
 * = free_time
 * × realism_factor
 * = productive_capacity
 */
const computeCapacity = async (userId) => {
  const [user, sleep, blocks] = await Promise.all([
    findUserWithPreferences(userId),
    getSleepSchedule(userId),
    getBlocks(userId),
  ]);

  // Sleep calculation
  let sleepMinutesPerWeek = 0;
  let sleepMinutesPerNight = 0;
  if (sleep) {
    sleepMinutesPerNight = calcSleepMinutesPerNight(
      sleep.sleep_time.slice(0, 5),
      sleep.wake_time.slice(0, 5)
    );
    sleepMinutesPerWeek = sleepMinutesPerNight * 7;
  }

  // Committed blocks calculation
  const committedMinutes = blocks.reduce((sum, block) => {
    const start = timeToMinutes(block.start_time.slice(0, 5));
    const end = timeToMinutes(block.end_time.slice(0, 5));
    return sum + (end - start);
  }, 0);

  const freeMinutes = TOTAL_WEEK_MINUTES - sleepMinutesPerWeek - committedMinutes;
  const realismFactor = parseFloat(user?.realism_factor || 0.70);
  const productiveCapacity = Math.round(freeMinutes * realismFactor);

  return {
    totalWeekMinutes: TOTAL_WEEK_MINUTES,
    sleepMinutesPerNight,
    sleepMinutesPerWeek,
    committedMinutes,
    freeMinutes,
    realismFactor,
    productiveCapacityMinutes: Math.max(0, productiveCapacity),
    productiveCapacityHours: +(Math.max(0, productiveCapacity) / 60).toFixed(1),
    breakdown: {
      blocksCount: blocks.length,
      hasSleepSchedule: !!sleep,
    },
  };
};

module.exports = { computeCapacity };