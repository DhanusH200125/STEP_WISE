// src/services/task.service.js
import api from './api';

export const getTasks = (params) => api.get('/tasks', { params });
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const completeTask = (id, data) => api.post(`/tasks/${id}/complete`, data);