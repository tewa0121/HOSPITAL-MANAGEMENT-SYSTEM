const service = require('./users.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'users', recordId, details, ip: req.ip });

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.list = wrap(async (req, res) => ok(res, await service.list(req.query, req.user)));
exports.lookups = wrap(async (req, res) => ok(res, await service.lookups(req.user)));

exports.create = wrap(async (req, res) => {
  const r = await service.create(req.body, req.user);
  await audit(req, 'CREATE_USER', r.id, { username: r.username, role: r.role }); // never the password
  res.set('Cache-Control', 'no-store');
  ok(res, r, 'User created', 201);
});

exports.update = wrap(async (req, res) => {
  const r = await service.update(Number(req.params.id), req.body, req.user);
  await audit(req, 'UPDATE_USER', req.params.id, r);
  ok(res, null, 'User updated');
});

exports.status = wrap(async (req, res) => {
  const active = req.body.is_active === true;
  const r = await service.setStatus(Number(req.params.id), active, req.user);
  await audit(req, active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', req.params.id, r);
  ok(res, null, active ? 'Account activated' : 'Account deactivated');
});

exports.unlock = wrap(async (req, res) => {
  const r = await service.unlock(Number(req.params.id), req.user);
  await audit(req, 'UNLOCK_USER', req.params.id, r);
  ok(res, null, 'Account unlocked');
});

exports.resetPassword = wrap(async (req, res) => {
  const r = await service.resetPassword(Number(req.params.id), req.user);
  await audit(req, 'RESET_PASSWORD', req.params.id, { username: r.username }); // never the password
  res.set('Cache-Control', 'no-store');
  ok(res, r, 'Temporary password created');
});

exports.getPermissions = wrap(async (req, res) => ok(res, await service.getPermissions(Number(req.params.id))));

exports.setPermissions = wrap(async (req, res) => {
  const r = await service.setPermissions(Number(req.params.id), req.body.overrides);
  await audit(req, 'SET_USER_PERMISSIONS', req.params.id, r);
  ok(res, r, 'Permissions saved');
});