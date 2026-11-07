import api from './axios';

export const requestsApi = {
  list: (params) => api.get('/requests', { params }),
  setStatus: (id, data) => api.patch(`/requests/${id}/status`, data),
  schedule: (id, data) => api.post(`/requests/${id}/schedule`, data),
};

export const newsApi = {
  list: () => api.get('/news'),
  create: (data) => api.post('/news', data),
  update: (id, data) => api.put(`/news/${id}`, data),
  remove: (id) => api.delete(`/news/${id}`),
};
