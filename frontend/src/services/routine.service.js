// src/services/routine.service.js
import api from './api';

export const setSleep = (data) => api.post('/routines/sleep', data);
export const getSleep = () => api.get('/routines/sleep');
export const getBlocks = () => api.get('/routines/blocks');
export const addBlock = (data) => api.post('/routines/blocks', data);
export const updateBlock = (id, data) => api.put(`/routines/blocks/${id}`, data);
export const deleteBlock = (id) => api.delete(`/routines/blocks/${id}`);
export const getCapacity = () => api.get('/routines/capacity');