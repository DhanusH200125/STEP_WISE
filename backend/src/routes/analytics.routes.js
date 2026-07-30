// backend/src/routes/analytics.routes.js
const express = require('express');
const { weeklyReport, summary } = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/weekly-report/:weekStart', weeklyReport);
router.get('/summary', summary);

module.exports = router;