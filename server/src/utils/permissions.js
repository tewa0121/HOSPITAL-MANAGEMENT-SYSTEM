const pool = require('../config/db');

async function loadPermissions(userId, roleId) {
  const [rows] = await pool.query(
    `SELECT p.code FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [roleId]
  );
  const set = new Set(rows.map((r) => r.code));

  const [overrides] = await pool.query(
    `SELECT p.code, up.is_granted FROM user_permissions up
     JOIN permissions p ON p.id = up.permission_id
     WHERE up.user_id = ?`,
    [userId]
  );
  overrides.forEach((o) => (o.is_granted ? set.add(o.code) : set.delete(o.code)));

  return [...set].sort();
}

module.exports = { loadPermissions };