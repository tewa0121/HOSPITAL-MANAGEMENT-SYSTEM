import api from './axios';

export const wardsApi = {
  board: () => api.get('/wards/board'),
  availableBeds: (patient_id) => api.get('/wards/beds/available', { params: { patient_id } }),
  bedStatus: (bedId, status) => api.patch(`/wards/beds/${bedId}/status`, { status }),
  createWard: (data) => api.post('/wards', data),
  updateWard: (id, data) => api.put(`/wards/${id}`, data),
  addBeds: (id, count) => api.post(`/wards/${id}/beds`, { count }),

  admissions: (params) => api.get('/wards/admissions', { params }),
  admission: (id) => api.get(`/wards/admissions/${id}`),
  admit: (data) => api.post('/wards/admissions', data),
  transfer: (id, data) => api.patch(`/wards/admissions/${id}/transfer`, data),
  discharge: (id, summary) => api.patch(`/wards/admissions/${id}/discharge`, { summary }),
  addNote: (id, note) => api.post(`/wards/admissions/${id}/notes`, { note }),
};