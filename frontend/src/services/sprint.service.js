// src/services/sprint.service.js
import api from './api';

export const generateSprint = (weekStart) =>
  api.post('/sprints/generate', { weekStart });
export const getSprint = (weekStart) =>
  api.get(`/sprints/${weekStart}`);
export const acceptSprint = (id) =>
  api.patch(`/sprints/${id}/accept`);
export const toggleSlotLock = (sprintId, slotId, isLocked) =>
  api.patch(`/sprints/${sprintId}/slots/${slotId}/lock`, { isLocked });