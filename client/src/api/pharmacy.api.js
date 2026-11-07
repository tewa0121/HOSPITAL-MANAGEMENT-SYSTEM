import api from './axios';

export const pharmacyApi = {
  prescriptions: (params) => api.get('/pharmacy/prescriptions', { params }),
  prescription: (id) => api.get(`/pharmacy/prescriptions/${id}`),
  dispense: (id, data) => api.post(`/pharmacy/prescriptions/${id}/dispense`, data),
  stock: (params) => api.get('/pharmacy/stock', { params }),
  batches: (medId) => api.get(`/pharmacy/stock/${medId}/batches`),
  receive: (data) => api.post('/pharmacy/stock/receive', data),
  adjust: (batchId, data) => api.patch(`/pharmacy/stock/batches/${batchId}/adjust`, data),
  createMedication: (data) => api.post('/pharmacy/medications', data),
  updateMedication: (id, data) => api.put(`/pharmacy/medications/${id}`, data),
};