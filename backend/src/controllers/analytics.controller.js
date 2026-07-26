// backend/src/controllers/analytics.controller.js
const { generateWeeklyReport, getAllTimeSummary } = require('../services/analytics.service');

const weeklyReport = async (req, res, next) => {
  try {
    const { weekStart } = req.params;
    const report = await generateWeeklyReport(req.user.id, weekStart);
    if (report.error) return res.status(404).json({ error: { message: report.error } });
    return res.status(200).json({ report });
  } catch (err) { next(err); }
};

const summary = async (req, res, next) => {
  try {
    const data = await getAllTimeSummary(req.user.id);
    return res.status(200).json({ summary: data });
  } catch (err) { next(err); }
};

module.exports = { weeklyReport, summary };