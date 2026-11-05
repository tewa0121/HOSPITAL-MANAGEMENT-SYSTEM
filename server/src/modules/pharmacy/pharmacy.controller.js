const service = require('./pharmacy.service');
const { ok, fail } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'pharmacy', recordId, details, ip: req.ip });

exports.prescriptions = async (req, res, next) => {
  try { ok(res, await service.listPrescriptions(req.query, req.user)); } catch (e) { next(e); }
};

exports.prescription = async (req, res, next) => {
  try {
    const data = await service.prescriptionDetail(Number(req.params.id), req.user);
    await audit(req, 'VIEW_PRESCRIPTION', req.params.id, { patient_id: data.patient_id });
    ok(res, data);
  } catch (e) { next(e); }
};

exports.dispense = async (req, res, next) => {
  try {
    const r = await service.dispense(Number(req.params.id), req.body, req.user);
    if (!r.done) return fail(res, 409, 'Possible allergy conflict', { conflicts: r.conflicts });
    await audit(req, 'DISPENSE', req.params.id, {
      status: r.status,
      items: r.items.map((i) => ({ medication: i.medication, quantity: i.quantity, batches: i.batches, controlled: i.controlled || undefined })),
      allergy_override: r.overridden || undefined,
      conflicts: r.overridden ? r.conflicts : undefined,
      override_reason: r.override_reason,
    });
    ok(res, { status: r.status, items: r.items }, 'Medication dispensed');
  } catch (e) { next(e); }
};

exports.stock = async (req, res, next) => {
  try { ok(res, await service.listStock(req.query, req.user)); } catch (e) { next(e); }
};

exports.batches = async (req, res, next) => {
  try { ok(res, await service.listBatches(Number(req.params.medId))); } catch (e) { next(e); }
};

exports.receive = async (req, res, next) => {
  try {
    const r = await service.receive(req.body);
    await audit(req, 'RECEIVE_STOCK', req.body.medication_id, r);
    ok(res, r, 'Stock received', 201);
  } catch (e) { next(e); }
};

exports.adjust = async (req, res, next) => {
  try {
    const r = await service.adjust(Number(req.params.batchId), req.body);
    await audit(req, 'ADJUST_STOCK', req.params.batchId, r);
    ok(res, r, 'Stock adjusted');
  } catch (e) { next(e); }
};

exports.createMedication = async (req, res, next) => {
  try {
    const id = await service.createMedication(req.body);
    await audit(req, 'CREATE_MEDICATION', id, { name: req.body.generic_name, price: req.body.unit_price });
    ok(res, { id }, 'Medication created', 201);
  } catch (e) { next(e); }
};

exports.updateMedication = async (req, res, next) => {
  try {
    const r = await service.updateMedication(Number(req.params.id), req.body);
    await audit(req, 'UPDATE_MEDICATION', req.params.id, r);
    ok(res, null, 'Medication updated');
  } catch (e) { next(e); }
};