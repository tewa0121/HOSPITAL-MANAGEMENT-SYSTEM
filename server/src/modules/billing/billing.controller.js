const service = require('./billing.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'billing', recordId, details, ip: req.ip });

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.summary = wrap(async (req, res) => ok(res, await service.summary(req.user)));
exports.unbilled = wrap(async (req, res) => ok(res, await service.unbilled(req.query)));
exports.services = wrap(async (req, res) => ok(res, await service.services()));
exports.list = wrap(async (req, res) => ok(res, await service.list(req.query)));

exports.get = wrap(async (req, res) => {
  const data = await service.detail(Number(req.params.id));
  await audit(req, 'VIEW', req.params.id, { patient_id: data.patient_id });
  ok(res, data);
});

exports.create = wrap(async (req, res) => {
  const { encounter_id, admission_id } = req.body;
  const r = admission_id
    ? await service.createForAdmission(Number(admission_id), req.user)
    : await service.createForEncounter(Number(encounter_id), req.user);
  await audit(req, 'CREATE_INVOICE', r.id, { invoice_no: r.invoice_no, encounter_id, admission_id, total: r.total });
  ok(res, r, 'Invoice created', 201);
});

exports.unbilledAdmissions = wrap(async (req, res) => ok(res, await service.unbilledAdmissions(req.query)));

exports.sync = wrap(async (req, res) => {
  const r = await service.syncItems(Number(req.params.id));
  await audit(req, 'SYNC_INVOICE', req.params.id, r);
  ok(res, r, 'Invoice updated from the visit');
});

exports.addItem = wrap(async (req, res) => {
  const r = await service.addItem(Number(req.params.id), req.body);
  await audit(req, 'ADD_ITEM', req.params.id, r);
  ok(res, r, 'Service added', 201);
});

exports.removeItem = wrap(async (req, res) => {
  const r = await service.removeItem(Number(req.params.id), Number(req.params.itemId));
  await audit(req, 'REMOVE_ITEM', req.params.id, r);
  ok(res, null, 'Item removed');
});

exports.pay = wrap(async (req, res) => {
  const r = await service.pay(Number(req.params.id), req.body, req.user);
  await audit(req, 'PAYMENT', req.params.id, {
    receipt_no: r.receipt_no, amount: r.amount, method: r.method, reference: r.reference, status: r.status,
  });
  ok(res, r, 'Payment recorded', 201);
});

exports.refund = wrap(async (req, res) => {
  const r = await service.refund(Number(req.params.id), req.body, req.user);
  await audit(req, 'REFUND', req.params.id, r);
  ok(res, r, 'Refund recorded', 201);
});

exports.discount = wrap(async (req, res) => {
  const r = await service.setDiscount(Number(req.params.id), req.body, req.user);
  await audit(req, 'DISCOUNT', req.params.id, r);
  ok(res, null, 'Discount saved');
});

exports.cancel = wrap(async (req, res) => {
  const r = await service.cancel(Number(req.params.id), req.body.reason);
  await audit(req, 'CANCEL_INVOICE', req.params.id, r);
  ok(res, null, 'Invoice cancelled');
});