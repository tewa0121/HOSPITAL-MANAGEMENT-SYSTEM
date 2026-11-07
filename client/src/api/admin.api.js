import api from './axios';

export const adminApi = {
  users: (params) => api.get('/users', { params }),
  userLookups: () => api.get('/users/lookups'),
  createUser: (d) => api.post('/users', d),
  updateUser: (id, d) => api.put(`/users/${id}`, d),
  setUserStatus: (id, is_active) => api.patch(`/users/${id}/status`, { is_active }),
  unlockUser: (id) => api.patch(`/users/${id}/unlock`),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  userPermissions: (id) => api.get(`/users/${id}/permissions`),
  setUserPermissions: (id, overrides) => api.put(`/users/${id}/permissions`, { overrides }),

  roles: () => api.get('/roles'),
  role: (id) => api.get(`/roles/${id}`),
  createRole: (d) => api.post('/roles', d),
  updateRole: (id, d) => api.put(`/roles/${id}`, d),
  setRolePermissions: (id, permission_ids) => api.put(`/roles/${id}/permissions`, { permission_ids }),
  deleteRole: (id) => api.delete(`/roles/${id}`),

  audit: (params) => api.get('/audit', { params }),
  auditFilters: () => api.get('/audit/filters'),
  logins: (params) => api.get('/audit/logins', { params }),

  settings: () => api.get('/settings'),
  saveSettings: (d) => api.put('/settings', d),
};