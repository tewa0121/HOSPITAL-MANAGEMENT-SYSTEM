const service = require('./lab.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'lab', recordId, details, ip: req.ip });

exports.list = async (req, res, next) => {
  try { ok(res, await service.list(req.query, req.user)); } catch (e) { next(e); }
};

exports.collect = async (req, res, next) => {
  try {
    const r = await service.collect(Number(req.params.id), req.user);
    await audit(req, 'COLLECT_SAMPLE', req.params.id, r);
    ok(res, r, 'Sample collected');
  } catch (e) { next(e); }
};

exports.start = async (req, res, next) => {
  try {
    await service.startProcessing(Number(req.params.id));
    await audit(req, 'START_PROCESSING', req.params.id);
    ok(res, null, 'Processing started');
  } catch (e) { next(e); }
};

exports.saveResult = async (req, res, next) => {
  try {
    const r = await service.saveResult(Number(req.params.id), req.body, req.user);
    // the previous value is kept in the audit log, so a correction never erases history
    await audit(req, r.previous ? 'CORRECT_RESULT' : 'ENTER_RESULT', req.params.id, r);
    ok(res, { flag: r.flag }, 'Result saved');
  } catch (e) { next(e); }
};

exports.verify = async (req, res, next) => {
  try {
    const r = await service.verify(Number(req.params.id), req.user);
    await audit(req, 'VERIFY_RESULT', req.params.id, { flag: r.flag, self_verified: r.self || undefined });
    if (r.critical) await audit(req, 'CRITICAL_RESULT', req.params.id, { note: 'Critical result released' });
    ok(res, { critical: r.critical }, 'Result verified');
  } catch (e) { next(e); }
};

exports.reject = async (req, res, next) => {
  try {
    await service.reject(Number(req.params.id), req.body.reason, req.user);
    await audit(req, 'REJECT_SAMPLE', req.params.id, { reason: req.body.reason });
    ok(res, null, 'Sample rejected');
  } catch (e) { next(e); }
};

exports.catalog = async (req, res, next) => {
  try { ok(res, await service.listCatalog(req.user)); } catch (e) { next(e); }
};

exports.createTest = async (req, res, next) => {
  try {
    const id = await service.createTest(req.body);
    await audit(req, 'CREATE_TEST', id, { code: req.body.code, name: req.body.name, price: req.body.price });
    ok(res, { id }, 'Test created', 201);
  } catch (e) { next(e); }
};

exports.updateTest = async (req, res, next) => {
  try {
    const r = await service.updateTest(Number(req.params.id), req.body);
    await audit(req, 'UPDATE_TEST', req.params.id, r);
    ok(res, null, 'Test updated');
  } catch (e) { next(e); }
};