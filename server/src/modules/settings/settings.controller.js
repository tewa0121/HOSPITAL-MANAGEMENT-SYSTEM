const service = require('./settings.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.publicInfo = wrap(async (req, res) => ok(res, await service.publicInfo()));
exports.get = wrap(async (req, res) => ok(res, await service.all()));

exports.update = wrap(async (req, res) => {
  const changes = await service.update(req.body);
  if (Object.keys(changes).length) {
    await logAudit({ userId: req.user.id, action: 'UPDATE_SETTINGS', module: 'settings', details: changes, ip: req.ip });
  }
  ok(res, changes, 'Settings saved');
});