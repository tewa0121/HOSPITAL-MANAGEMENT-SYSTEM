const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');

// Clinical details are hidden from users without clinical access (the hospital administrator).
const CLINICAL_MODULES = new Set(['patients', 'encounters', 'lab', 'pharmacy', 'wards']);
const OPERATIONAL = new Set([
  'CREATE_WARD', 'UPDATE_WARD', 'ADD_BEDS', 'BED_STATUS', 'RECEIVE_STOCK', 'ADJUST_STOCK',
  'CREATE_MEDICATION', 'UPDATE_MEDICATION', 'CREATE_TEST', 'UPDATE_TEST',
]);
const isClinical = (r) => CLINICAL_MODULES.has(r.module) && !OPERATIONAL.has(r.action);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const parseDate = (v, label) => {
  if (!v) return null;
  if (!DATE_RE.test(v) || Number.isNaN(new Date(`${v}T00:00:00`).getTime())) throw new HttpError(422, `Invalid ${label} date`);
  return v;
};

function range(col, f, where, params) {
  const from = parseDate(f.from, 'start');
  const to = parseDate(f.to, 'end');
  if (from && to && from > to) throw new HttpError(422, 'The start date must not be after the end date');
  if (from) { where.push(`${col} >= ?`); params.push(from); }
  if (to) { where.push(`${col} < DATE_ADD(?, INTERVAL 1 DAY)`); params.push(to); }
}

function parseDetails(d) {
  if (d === null || d === undefined) return null;
  if (typeof d !== 'string') return d;
  try { return JSON.parse(d); } catch { return d; }
}

async function list(f, user) {
  const page = Math.max(Number(f.page) || 1, 1);
  const limit = Math.min(Math.max(Number(f.limit) || 20, 1), 100);
  const where = [];
  const params = [];
  range('a.created_at', f, where, params);
  if (/^\d+$/.test(String(f.user_id || ''))) { where.push('a.user_id = ?'); params.push(Number(f.user_id)); }
  if (/^[a-z_]+$/.test(f.module || '')) { where.push('a.module = ?'); params.push(f.module); }
  if (/^[A-Z_]+$/.test(f.action || '')) { where.push('a.action = ?'); params.push(f.action); }
  const rec = (f.search || '').trim();
  if (rec) { where.push('a.record_id = ?'); params.push(rec.slice(0, 40)); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs a ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT a.id, a.created_at, a.action, a.module, a.record_id, a.details, a.ip_address, a.user_id,
            u.full_name AS user_name, u.username
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ${clause} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  const clinicalAccess = user.permissions.includes('encounters.read');
  const items = rows.map((r) => {
    const hidden = !clinicalAccess && isClinical(r) && r.details !== null;
    return { ...r, details: hidden ? null : parseDetails(r.details), details_hidden: hidden };
  });
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function filters() {
  const [modules] = await pool.query('SELECT DISTINCT module FROM audit_logs ORDER BY module');
  const [actions] = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  const [users] = await pool.query('SELECT id, full_name, username FROM users ORDER BY full_name');
  return { modules: modules.map((m) => m.module), actions: actions.map((a) => a.action), users };
}

async function logins(f) {
  const page = Math.max(Number(f.page) || 1, 1);
  const limit = Math.min(Math.max(Number(f.limit) || 20, 1), 100);
  const where = [];
  const params = [];
  range('h.created_at', f, where, params);
  if (f.result === 'success') where.push('h.success = 1');
  else if (f.result === 'failed') where.push('h.success = 0');
  const q = (f.search || '').trim();
  if (q) { where.push('h.username LIKE ?'); params.push(`%${q}%`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM login_history h ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT h.id, h.created_at, h.username, h.success, h.ip_address, h.user_agent, u.full_name
     FROM login_history h LEFT JOIN users u ON u.id = h.user_id
     ${clause} ORDER BY h.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  const [[s]] = await pool.query(
    `SELECT COALESCE(SUM(success = 1), 0) AS ok, COALESCE(SUM(success = 0), 0) AS failed
     FROM login_history WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
  );
  const [[l]] = await pool.query(
    'SELECT COUNT(*) AS n FROM users WHERE is_active = 1 AND locked_until IS NOT NULL AND locked_until > NOW()'
  );
  return {
    items: rows.map((r) => ({ ...r, success: !!r.success })),
    total, page, limit, pages: Math.max(1, Math.ceil(total / limit)),
    summary: { success_24h: Number(s.ok), failed_24h: Number(s.failed), locked_now: Number(l.n) },
  };
}

module.exports = { list, filters, logins };