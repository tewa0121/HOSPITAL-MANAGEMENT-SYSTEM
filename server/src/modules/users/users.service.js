const bcrypt = require('bcryptjs');
const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const withTransaction = require('../../utils/transaction');
const { generateTempPassword } = require('../../utils/password');

const PROTECTED = 'Only a super administrator can manage this account';

const orNull = (v) => {
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
};

function normalizePhone(v) {
  v = orNull(v);
  if (!v) return null;
  const digits = String(v).replace(/[\s-]/g, '').replace(/^\+?251/, '').replace(/^0/, '');
  return `+251${digits}`;
}

// A role is "privileged" when it holds roles.manage. Only people who hold it can manage such accounts.
const canPrivileged = (actor) => actor.permissions.includes('roles.manage');

async function privilegedRoleIds(conn) {
  const [rows] = await conn.query(
    `SELECT DISTINCT rp.role_id FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'roles.manage'`
  );
  return new Set(rows.map((r) => r.role_id));
}

async function emailTaken(conn, email, excludeId = 0) {
  const [rows] = await conn.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, excludeId]);
  return rows.length > 0;
}

async function lockUser(conn, id, actor) {
  const [[u]] = await conn.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [id]);
  if (!u) throw new HttpError(404, 'User not found');
  const priv = await privilegedRoleIds(conn);
  if (priv.has(u.role_id) && !canPrivileged(actor)) throw new HttpError(403, PROTECTED);
  return { u, priv };
}

async function checkRoleDept(conn, d, actor, priv) {
  const [[role]] = await conn.query('SELECT id, name FROM roles WHERE id = ?', [d.role_id]);
  if (!role) throw new HttpError(422, 'Select a valid role');
  if (priv.has(role.id) && !canPrivileged(actor)) throw new HttpError(403, 'Only a super administrator can assign this role');

  let departmentId = null;
  if (d.department_id) {
    const [[dept]] = await conn.query('SELECT id FROM departments WHERE id = ? AND is_active = 1', [d.department_id]);
    if (!dept) throw new HttpError(422, 'Select a valid department');
    departmentId = dept.id;
  }
  // consultation fees and schedules depend on the doctor's department
  if (role.name === 'doctor' && !departmentId) throw new HttpError(422, 'A doctor must belong to a department');
  return { role, department_id: departmentId };
}

async function assertNoOpenWork(conn, id) {
  const [[e]] = await conn.query(
    "SELECT COUNT(*) AS n FROM encounters WHERE doctor_id = ? AND status IN ('waiting','triaged','in_consultation','awaiting_results')", [id]
  );
  const [[a]] = await conn.query(
    "SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND appointment_date >= CURDATE() AND status IN ('scheduled','checked_in')", [id]
  );
  if (e.n || a.n) {
    throw new HttpError(409, `This user still has ${e.n} open visit(s) and ${a.n} upcoming appointment(s). Complete or cancel them first.`);
  }
}

// ---------- list and lookups ----------
async function list(f, actor) {
  const page = Math.max(Number(f.page) || 1, 1);
  const limit = Math.min(Math.max(Number(f.limit) || 10, 1), 100);
  const where = [];
  const params = [];

  const q = (f.search || '').trim();
  if (q) {
    where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (/^\d+$/.test(String(f.role_id || ''))) { where.push('u.role_id = ?'); params.push(Number(f.role_id)); }
  if (f.status === 'active') where.push('u.is_active = 1');
  else if (f.status === 'inactive') where.push('u.is_active = 0');
  else if (f.status === 'locked') where.push('(u.is_active = 1 AND u.locked_until IS NOT NULL AND u.locked_until > NOW())');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.phone, u.role_id, r.name AS role,
            r.display_name AS role_display, r.display_name_am AS role_display_am,
            u.department_id, d.name AS department, d.name_am AS department_am,
            u.is_active, u.locked_until, u.last_login_at, u.created_at, u.must_change_password,
            (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS is_locked
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     ${clause}
     ORDER BY u.is_active DESC, u.full_name LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  const [[s]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(is_active = 1), 0) AS active, COALESCE(SUM(is_active = 0), 0) AS inactive,
            COALESCE(SUM(is_active = 1 AND locked_until IS NOT NULL AND locked_until > NOW()), 0) AS locked
     FROM users`
  );

  const priv = await privilegedRoleIds(pool);
  const can = canPrivileged(actor);
  return {
    items: rows.map((r) => ({
      ...r,
      is_active: !!r.is_active, is_locked: !!r.is_locked, must_change_password: !!r.must_change_password,
      is_self: r.id === actor.id, protected: priv.has(r.role_id) && !can,
    })),
    total, page, limit, pages: Math.max(1, Math.ceil(total / limit)),
    summary: { total: Number(s.total), active: Number(s.active), inactive: Number(s.inactive), locked: Number(s.locked) },
  };
}

async function lookups(actor) {
  const priv = await privilegedRoleIds(pool);
  const [roles] = await pool.query('SELECT id, name, display_name, display_name_am FROM roles ORDER BY is_system DESC, id');
  const [departments] = await pool.query('SELECT id, name, name_am FROM departments WHERE is_active = 1 ORDER BY name');
  return { roles: roles.filter((r) => canPrivileged(actor) || !priv.has(r.id)), departments };
}

// ---------- create and edit ----------
async function create(d, actor) {
  const temp = generateTempPassword();
  const hash = await bcrypt.hash(temp, 10);
  return withTransaction(async (conn) => {
    const priv = await privilegedRoleIds(conn);
    const { role, department_id } = await checkRoleDept(conn, d, actor, priv);

    const [dup] = await conn.query('SELECT id FROM users WHERE username = ?', [d.username]);
    if (dup.length) throw new HttpError(409, 'This username is already taken');
    const email = orNull(d.email) ? String(d.email).trim().toLowerCase() : null;
    if (email && (await emailTaken(conn, email))) throw new HttpError(409, 'This email is already used by another user');

    const [r] = await conn.query(
      `INSERT INTO users (full_name, username, email, phone, password_hash, must_change_password, role_id, department_id)
       VALUES (?,?,?,?,?,1,?,?)`,
      [d.full_name.trim(), d.username, email, normalizePhone(d.phone), hash, role.id, department_id]
    );
    return { id: r.insertId, username: d.username, role: role.name, temporary_password: temp };
  });
}

async function update(id, d, actor) {
  return withTransaction(async (conn) => {
    const { u, priv } = await lockUser(conn, id, actor);
    const { role, department_id } = await checkRoleDept(conn, d, actor, priv);
    const email = orNull(d.email) ? String(d.email).trim().toLowerCase() : null;
    if (email && (await emailTaken(conn, email, id))) throw new HttpError(409, 'This email is already used by another user');

    const [[oldRole]] = await conn.query('SELECT name FROM roles WHERE id = ?', [u.role_id]);
    const roleChanged = role.id !== u.role_id;
    if (roleChanged) {
      if (u.id === actor.id) throw new HttpError(403, 'You cannot change your own role');
      if (oldRole.name === 'doctor') await assertNoOpenWork(conn, id);
    }

    await conn.query(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, role_id = ?, department_id = ? WHERE id = ?',
      [d.full_name.trim(), email, normalizePhone(d.phone), role.id, department_id, id]
    );
    // overrides were set against the old role, so they are cleared when the role changes
    if (roleChanged) await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
    return { username: u.username, role_changed: roleChanged, from_role: oldRole.name, to_role: role.name };
  });
}

async function setStatus(id, active, actor) {
  if (id === actor.id) throw new HttpError(403, 'You cannot change the status of your own account');
  return withTransaction(async (conn) => {
    const { u } = await lockUser(conn, id, actor);
    if (!!u.is_active === active) throw new HttpError(400, `The account is already ${active ? 'active' : 'inactive'}`);
    if (!active) await assertNoOpenWork(conn, id);
    await conn.query('UPDATE users SET is_active = ? WHERE id = ?', [active ? 1 : 0, id]);
    return { username: u.username };
  });
}

async function unlock(id, actor) {
  return withTransaction(async (conn) => {
    const { u } = await lockUser(conn, id, actor);
    await conn.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [id]);
    return { username: u.username };
  });
}

async function resetPassword(id, actor) {
  if (id === actor.id) throw new HttpError(403, 'Use "My account" to change your own password');
  const temp = generateTempPassword();
  const hash = await bcrypt.hash(temp, 10);
  return withTransaction(async (conn) => {
    const { u } = await lockUser(conn, id, actor);
    await conn.query(
      `UPDATE users SET password_hash = ?, must_change_password = 1, password_changed_at = NOW(),
              failed_attempts = 0, locked_until = NULL WHERE id = ?`,
      [hash, id]
    );
    return { username: u.username, temporary_password: temp };
  });
}

// ---------- per-user permission overrides (roles.manage only) ----------
async function getPermissions(id) {
  const [[u]] = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.role_id, r.name AS role,
            r.display_name AS role_display, r.display_name_am AS role_display_am
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [id]
  );
  if (!u) throw new HttpError(404, 'User not found');
  const priv = await privilegedRoleIds(pool);
  const [perms] = await pool.query(
    `SELECT p.id, p.code, p.module, p.action, p.description,
            (rp.role_id IS NOT NULL) AS from_role, up.is_granted
     FROM permissions p
     LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ?
     LEFT JOIN user_permissions up ON up.permission_id = p.id AND up.user_id = ?
     ORDER BY p.module, p.id`, [u.role_id, id]
  );
  return {
    user: { ...u, privileged: priv.has(u.role_id) },
    permissions: perms.map((p) => ({
      id: p.id, code: p.code, module: p.module, action: p.action, description: p.description,
      from_role: !!p.from_role,
      override: p.is_granted === null ? null : p.is_granted ? 'grant' : 'revoke',
    })),
  };
}

async function setPermissions(id, overrides) {
  return withTransaction(async (conn) => {
    const [[u]] = await conn.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [id]);
    if (!u) throw new HttpError(404, 'User not found');
    const priv = await privilegedRoleIds(conn);
    if (priv.has(u.role_id)) throw new HttpError(400, 'Administrators with this role already have every permission. Overrides do not apply.');

    const [perms] = await conn.query('SELECT id, code FROM permissions');
    const byId = new Map(perms.map((p) => [p.id, p.code]));
    const [roleRows] = await conn.query('SELECT permission_id FROM role_permissions WHERE role_id = ?', [u.role_id]);
    const roleHas = new Set(roleRows.map((r) => r.permission_id));

    const keep = new Map();
    for (const o of overrides) {
      const pid = Number(o.permission_id);
      if (!byId.has(pid)) throw new HttpError(422, 'Unknown permission');
      if (byId.get(pid) === 'dashboard.view' && !o.is_granted) throw new HttpError(422, 'Everyone keeps access to the dashboard');
      // only overrides that differ from the role default are stored
      if (o.is_granted !== roleHas.has(pid)) keep.set(pid, o.is_granted ? 1 : 0);
    }

    await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
    if (keep.size) {
      await conn.query('INSERT INTO user_permissions (user_id, permission_id, is_granted) VALUES ?',
        [[...keep].map(([pid, g]) => [id, pid, g])]);
    }
    return {
      username: u.username,
      granted: [...keep].filter(([, g]) => g === 1).map(([pid]) => byId.get(pid)),
      revoked: [...keep].filter(([, g]) => g === 0).map(([pid]) => byId.get(pid)),
    };
  });
}

module.exports = {
  list, lookups, create, update, setStatus, unlock, resetPassword, getPermissions, setPermissions,
};