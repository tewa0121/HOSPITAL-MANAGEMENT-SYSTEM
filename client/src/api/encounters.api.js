import api from './axios';

export const encountersApi = {
  list: (params) => api.get('/encounters', { params }),
  get: (id) => api.get(`/encounters/${id}`),
  addVitals: (id, data) => api.post(`/encounters/${id}/vitals`, data),
  start: (id) => api.patch(`/encounters/${id}/start`),
  saveNotes: (id, data) => api.put(`/encounters/${id}/notes`, data),
  addDiagnosis: (id, data) => api.post(`/encounters/${id}/diagnoses`, data),
  removeDiagnosis: (id, diagId) => api.delete(`/encounters/${id}/diagnoses/${diagId}`),
  orderLabs: (id, data) => api.post(`/encounters/${id}/lab-orders`, data),
  cancelLab: (id, orderId) => api.patch(`/encounters/${id}/lab-orders/${orderId}/cancel`),
  prescribe: (id, data) => api.post(`/encounters/${id}/prescriptions`, data),
  cancelRx: (id, rxId) => api.patch(`/encounters/${id}/prescriptions/${rxId}/cancel`),
  close: (id, force = false) => api.patch(`/encounters/${id}/close`, { force }),
  labTests: () => api.get('/encounters/lookups/lab-tests'),
  medications: () => api.get('/encounters/lookups/medications'),
};