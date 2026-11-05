const service = require('./roles.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'roles', recordId, details, ip: req.ip });

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.list = wrap(async (req, res) => ok(res, await service.list()));
exports.get = wrap(async (req, res) => ok(res, await service.detail(Number(req.params.id))));

exports.create = wrap(async (req, res) => {
  const r = await service.create(req.body);
  await audit(req, 'CREATE_ROLE', r.id, r);
  ok(res, r, 'Role created', 201);
});

exports.update = wrap(async (req, res) => {
  const r = await service.update(Number(req.params.id), req.body);
  await audit(req, 'UPDATE_ROLE', req.params.id, { name: r.name, display_name: req.body.display_name });
  ok(res, null, 'Role updated');
});

exports.setPermissions = wrap(async (req, res) => {
  const r = await service.setPermissions(Number(req.params.id), req.body.permission_ids);
  await audit(req, 'SET_ROLE_PERMISSIONS', req.params.id, r);
  ok(res, r, 'Permissions saved');
});

exports.remove = wrap(async (req, res) => {
  const r = await service.remove(Number(req.params.id));
  await audit(req, 'DELETE_ROLE', req.params.id, r);
  ok(res, null, 'Role deleted');
});