// backend/src/routes/growth.routes.js
const express = require('express');
const { getReport } = require('../controllers/growth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/report', getReport);

module.exports = router;