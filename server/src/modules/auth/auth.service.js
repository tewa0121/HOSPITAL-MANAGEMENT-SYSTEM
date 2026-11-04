const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { jwt: jwtCfg } = require('../../config/env');
const { loadPermissions } = require('../../utils/permissions');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

class AuthError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}

async function recordLogin(userId, username, success, ip, ua) {
  await pool.query(
    'INSERT INTO login_history (user_id, username, success, ip_address, user_agent) VALUES (?,?,?,?,?)',
    [userId, username, success ? 1 : 0, ip, (ua || '').slice(0, 250)]
  );
}

async function login(username, password, ip, userAgent) {
  const [[user]] = await pool.query(
    `SELECT u.*, r.name AS role, r.display_name AS role_display,
            d.name AS department, (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS is_locked
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.username = ?`,
    [username]
  );

  // Same response and similar timing for unknown users (no username guessing)
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await recordLogin(null, username, false, ip, userAgent);
    throw new AuthError('Invalid username or password');
  }

  if (!user.is_active) {
    await recordLogin(user.id, username, false, ip, userAgent);
    throw new AuthError('This account has been deactivated. Contact the administrator.', 403);
  }

  if (user.is_locked) {
    await recordLogin(user.id, username, false, ip, userAgent);
    throw new AuthError(`Account locked after too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`, 423);
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const attempts = user.failed_attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await pool.query(
        'UPDATE users SET failed_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
        [LOCK_MINUTES, user.id]
      );
    } else {
      await pool.query('UPDATE users SET failed_attempts = ? WHERE id = ?', [attempts, user.id]);
    }
    await recordLogin(user.id, username, false, ip, userAgent);
    throw new AuthError('Invalid username or password');
  }

  await pool.query(
    'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
    [user.id]
  );
  await recordLogin(user.id, username, true, ip, userAgent);

  const token = jwt.sign({ id: user.id, role: user.role }, jwtCfg.secret, { expiresIn: jwtCfg.expiresIn });
  const permissions = await loadPermissions(user.id, user.role_id);

  return {
    token,
    user: {
 id: user.id, full_name: user.full_name, username: user.username, email: user.email,
      role: user.role, role_display: user.role_display, department: user.department, permissions,
      must_change_password: !!user.must_change_password,
    },
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  const [[user]] = await pool.query(
    'SELECT u.password_hash, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', [userId]
  );
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new AuthError('Current password is incorrect', 400);
  }
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    throw new AuthError('The new password must be different from the current one', 400);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = NOW() WHERE id = ?',
    [hash, userId]
  );
  // older tokens stop working after a password change, so the user gets a fresh one
  return jwt.sign({ id: userId, role: user.role }, jwtCfg.secret, { expiresIn: jwtCfg.expiresIn });
}

module.exports = { login, changePassword, AuthError };