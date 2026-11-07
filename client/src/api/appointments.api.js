import api from './axios';

export const appointmentsApi = {
  doctors: () => api.get('/appointments/doctors'),
  slots: (params) => api.get('/appointments/slots', { params }),
  list: (params) => api.get('/appointments', { params }),
  create: (data) => api.post('/appointments', data),
  checkIn: (id) => api.patch(`/appointments/${id}/check-in`),
  cancel: (id) => api.patch(`/appointments/${id}/cancel`),
  reschedule: (id, data) => api.patch(`/appointments/${id}/reschedule`, data),
  noShow: (id) => api.patch(`/appointments/${id}/no-show`),
};