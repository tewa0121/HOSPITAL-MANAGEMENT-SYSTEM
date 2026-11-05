const service = require('./reports.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.dashboard = wrap(async (req, res) => ok(res, await service.dashboard(req.user)));

exports.section = wrap(async (req, res) => ok(res, await service.section(req.params.section, req.query, req.user)));

// The CSV is built in the browser; this call records who exported what (and fails if the period is invalid)
exports.exportLog = wrap(async (req, res) => {
  const { from, to } = service.parseRange(req.body);
  await logAudit({
    userId: req.user.id, action: 'EXPORT', module: 'reports', recordId: req.body.section,
    details: { section: req.body.section, from, to, format: 'csv' }, ip: req.ip,
  });
  ok(res, null, 'Export recorded');
});