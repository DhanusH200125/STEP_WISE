// src/services/auth.service.js
import api from './api';

export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const logout = () => {
  const refreshToken = localStorage.getItem('refreshToken');
  return api.post('/auth/logout', { refreshToken });
};
export const getMe = () => api.get('/auth/me');