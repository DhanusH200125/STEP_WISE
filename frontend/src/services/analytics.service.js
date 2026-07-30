// src/services/analytics.service.js
import api from './api';

export const getWeeklyReport = (weekStart) =>
  api.get(`/analytics/weekly-report/${weekStart}`);
export const getSummary = () =>
  api.get('/analytics/summary');
export const getGrowthReport = () =>
  api.get('/growth/report');