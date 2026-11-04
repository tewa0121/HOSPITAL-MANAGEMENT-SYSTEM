const service = require('./auth.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await service.login(username.trim(), password, req.ip, req.headers['user-agent']);
    await logAudit({ userId: result.user.id, action: 'LOGIN', module: 'auth', ip: req.ip });
    ok(res, result, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = (req, res) => ok(res, req.user);

exports.logout = async (req, res, next) => {
  try {
    await logAudit({ userId: req.user?.id, action: 'LOGOUT', module: 'auth', ip: req.ip });
    ok(res, null, 'Logged out');
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const token = await service.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    await logAudit({ userId: req.user.id, action: 'CHANGE_PASSWORD', module: 'auth', ip: req.ip });
    ok(res, { token }, 'Password changed successfully');
  } catch (err) { next(err); }
};