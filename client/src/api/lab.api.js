import api from './axios';

export const labApi = {
  orders: (params) => api.get('/lab/orders', { params }),
  collect: (id) => api.patch(`/lab/orders/${id}/collect`),
  start: (id) => api.patch(`/lab/orders/${id}/start`),
  saveResult: (id, data) => api.put(`/lab/orders/${id}/result`, data),
  verify: (id) => api.patch(`/lab/orders/${id}/verify`),
  reject: (id, reason) => api.patch(`/lab/orders/${id}/reject`, { reason }),
  catalog: () => api.get('/lab/catalog'),
  createTest: (data) => api.post('/lab/catalog', data),
  updateTest: (id, data) => api.put(`/lab/catalog/${id}`, data),
};