// backend/src/controllers/growth.controller.js
const { getGrowthReport } = require('../services/growth.service');

/**
 * GET /api/growth/report
 * Returns full growth tracking report for current user
 */
const getReport = async (req, res, next) => {
  try {
    const report = await getGrowthReport(req.user.id);
    return res.status(200).json({ report });
  } catch (err) { next(err); }
};

module.exports = { getReport };