export const MODULE_ORDER = [
  'dashboard', 'patients', 'appointments', 'encounters', 'vitals', 'diagnoses', 'lab', 'prescriptions',
  'pharmacy', 'billing', 'wards', 'admissions', 'reports', 'users', 'roles', 'audit', 'settings',
];

export const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
export const ROLE_KEY_RE = /^[a-z][a-z0-9_]{2,39}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// [{ module, items: [permission...] }] in a sensible order
export function groupPermissions(perms) {
  const map = {};
  perms.forEach((p) => { (map[p.module] ||= []).push(p); });
  const known = MODULE_ORDER.filter((m) => map[m]);
  const extra = Object.keys(map).filter((m) => !MODULE_ORDER.includes(m)).sort();
  return [...known, ...extra].map((m) => ({ module: m, items: map[m] }));
}

// roles from /roles use display_name, users from /users use role_display
export const roleLabel = (r, lang) => {
  const am = r.display_name_am || r.role_display_am;
  return lang === 'am' && am ? am : (r.display_name || r.role_display);
};
export const deptLabel = (d, lang) => (lang === 'am' && d.department_am ? d.department_am : d.department);

export function actionTone(action) {
  if (/(DELETE|REMOVE|CANCEL|REFUND|REJECT|DEACTIVATE|RESET|UNLOCK)/.test(action)) return 'red';
  if (/(LOGIN|LOGOUT|VIEW)/.test(action)) return 'slate';
  if (/(UPDATE|EDIT|SET_|CORRECT|CHANGE|ADJUST|TRANSFER|SYNC)/.test(action)) return 'blue';
  return 'teal';
}