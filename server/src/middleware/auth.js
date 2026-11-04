const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwt: jwtCfg } = require('../config/env');
const { fail } = require('../utils/response');
const { loadPermissions } = require('../utils/permissions');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return fail(res, 401, 'Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, jwtCfg.secret);
    } catch {
      return fail(res, 401, 'Session expired or invalid. Please log in again.');
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.role_id, r.name as role, u.is_active, u.must_change_password 
       FROM users u 
       JOIN roles r ON r.id = u.role_id 
       WHERE u.id = ?`,
      [payload.id]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return fail(res, 401, 'Account is inactive or not found');
    }

    user.permissions = await loadPermissions(user.id, user.role_id);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };