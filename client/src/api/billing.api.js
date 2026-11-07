import api from './axios';

export const billingApi = {
  summary: () => api.get('/billing/summary'),
  unbilled: (params) => api.get('/billing/unbilled', { params }),
  unbilledAdmissions: (params) => api.get('/billing/unbilled-admissions', { params }),
  createForAdmission: (admission_id) => api.post('/billing/invoices', { admission_id }),
  services: () => api.get('/billing/services'),
  invoices: (params) => api.get('/billing/invoices', { params }),
  get: (id) => api.get(`/billing/invoices/${id}`),
  create: (data) => api.post('/billing/invoices', typeof data === 'object' && data !== null ? data : { encounter_id: Number(data) }),
  sync: (id) => api.patch(`/billing/invoices/${id}/sync`),
  addItem: (id, data) => api.post(`/billing/invoices/${id}/items`, data),
  removeItem: (id, itemId) => api.delete(`/billing/invoices/${id}/items/${itemId}`),
  pay: (id, data) => api.post(`/billing/invoices/${id}/payments`, data),
  refund: (id, data) => api.post(`/billing/invoices/${id}/refund`, data),
  discount: (id, data) => api.patch(`/billing/invoices/${id}/discount`, data),
  cancel: (id, reason) => api.patch(`/billing/invoices/${id}/cancel`, { reason }),
};