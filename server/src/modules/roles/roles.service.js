const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const withTransaction = require('../../utils/transaction');

const orNull = (v) => {
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
};

async function list() {
  const [roles] = await pool.query(
    `SELECT r.id, r.name, r.display_name, r.display_name_am, r.description, r.is_system,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
     FROM roles r ORDER BY r.is_system DESC, r.id`
  );
  const [permissions] = await pool.query('SELECT id, code, module, action, description FROM permissions ORDER BY module, id');
  return {
    roles: roles.map((r) => ({ ...r, is_system: !!r.is_system, user_count: Number(r.user_count), permission_count: Number(r.permission_count) })),
    permissions,
  };
}

async function detail(id) {
  const [[role]] = await pool.query(
    'SELECT id, name, display_name, display_name_am, description, is_system FROM roles WHERE id = ?', [id]
  );
  if (!role) throw new HttpError(404, 'Role not found');
  const [rows] = await pool.query('SELECT permission_id FROM role_permissions WHERE role_id = ?', [id]);
  return { ...role, is_system: !!role.is_system, permission_ids: rows.map((r) => r.permission_id) };
}

async function create(d) {
  return withTransaction(async (conn) => {
    const [dup] = await conn.query('SELECT id FROM roles WHERE name = ?', [d.name]);
    if (dup.length) throw new HttpError(409, 'A role with this key already exists');
    const [r] = await conn.query(
      'INSERT INTO roles (name, display_name, display_name_am, description, is_system) VALUES (?,?,?,?,0)',
      [d.name, d.display_name.trim(), orNull(d.display_name_am), orNull(d.description)]
    );
    if (d.copy_from) {
      const [[src]] = await conn.query('SELECT id FROM roles WHERE id = ?', [d.copy_from]);
      if (!src) throw new HttpError(422, 'The role to copy from does not exist');
      await conn.query(
        'INSERT INTO role_permissions (role_id, permission_id) SELECT ?, permission_id FROM role_permissions WHERE role_id = ?',
        [r.insertId, src.id]
      );
    }
    // every role can open its dashboard
    await conn.query(
      "INSERT IGNORE INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions WHERE code = 'dashboard.view'",
      [r.insertId]
    );
    return { id: r.insertId, name: d.name, copied_from: d.copy_from || null };
  });
}

async function update(id, d) {
  return withTransaction(async (conn) => {
    const [[role]] = await conn.query('SELECT * FROM roles WHERE id = ? FOR UPDATE', [id]);
    if (!role) throw new HttpError(404, 'Role not found');
    await conn.query('UPDATE roles SET display_name = ?, display_name_am = ?, description = ? WHERE id = ?',
      [d.display_name.trim(), orNull(d.display_name_am), orNull(d.description), id]);
    return { name: role.name };
  });
}

async function setPermissions(id, ids) {
  return withTransaction(async (conn) => {
    const [[role]] = await conn.query('SELECT * FROM roles WHERE id = ? FOR UPDATE', [id]);
    if (!role) throw new HttpError(404, 'Role not found');
    if (role.name === 'super_admin') throw new HttpError(403, 'The permissions of the super administrator role cannot be edited');

    const [perms] = await conn.query('SELECT id, code FROM permissions');
    const byId = new Map(perms.map((p) => [p.id, p.code]));
    const wanted = new Set(ids.map(Number));
    for (const pid of wanted) if (!byId.has(pid)) throw new HttpError(422, 'Unknown permission');
    // every role keeps its dashboard
    wanted.add(perms.find((p) => p.code === 'dashboard.view').id);

    const [cur] = await conn.query('SELECT permission_id FROM role_permissions WHERE role_id = ?', [id]);
    const before = new Set(cur.map((r) => r.permission_id));
    const added = [...wanted].filter((p) => !before.has(p)).map((p) => byId.get(p));
    const removed = [...before].filter((p) => !wanted.has(p)).map((p) => byId.get(p));

    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [[...wanted].map((p) => [id, p])]);
    // overrides that now match the new role default are redundant, so remove them
    await conn.query(
      `DELETE up FROM user_permissions up JOIN users u ON u.id = up.user_id
       WHERE u.role_id = ? AND ((up.is_granted = 1 AND up.permission_id IN (?)) OR (up.is_granted = 0 AND up.permission_id NOT IN (?)))`,
      [id, [...wanted], [...wanted]]
    );
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM users WHERE role_id = ?', [id]);
    return { role: role.name, added, removed, users_affected: Number(n) };
  });
}

async function remove(id) {
  return withTransaction(async (conn) => {
    const [[role]] = await conn.query('SELECT * FROM roles WHERE id = ? FOR UPDATE', [id]);
    if (!role) throw new HttpError(404, 'Role not found');
    if (role.is_system) throw new HttpError(403, 'System roles cannot be deleted');
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM users WHERE role_id = ?', [id]);
    if (n) throw new HttpError(409, `This role is assigned to ${n} user(s). Move them to another role first.`);
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    await conn.query('DELETE FROM roles WHERE id = ?', [id]);
    return { name: role.name };
  });
}

module.exports = { list, detail, create, update, setPermissions, remove };