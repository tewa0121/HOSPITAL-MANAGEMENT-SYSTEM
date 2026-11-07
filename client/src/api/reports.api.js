import api from './axios';

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  section: (name, params) => api.get(`/reports/${name}`, { params }),
  exportLog: (data) => api.post('/reports/export-log', data),
};