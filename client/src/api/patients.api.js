import api from './axios';

export const patientsApi = {
  list: (params) => api.get('/patients', { params }),
  get: (id) => api.get(`/patients/${id}`),
  create: (data, force = false) => api.post('/patients', { ...data, force }),
  update: (id, data) => api.put(`/patients/${id}`, data),
  addAllergy: (id, data) => api.post(`/patients/${id}/allergies`, data),
  removeAllergy: (id, allergyId) => api.delete(`/patients/${id}/allergies/${allergyId}`),
};