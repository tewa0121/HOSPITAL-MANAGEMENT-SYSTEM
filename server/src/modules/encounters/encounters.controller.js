const service = require('./encounters.service');
const { ok, fail } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'encounters', recordId, details, ip: req.ip });

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const int = (v) => { const n = num(v); return n === null ? null : Math.round(n); };

exports.list = async (req, res, next) => {
  try { ok(res, await service.list(req.query, req.user)); } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const data = await service.detail(Number(req.params.id), req.user);
    await audit(req, 'VIEW', req.params.id, { patient_id: data.patient_id });
    ok(res, data);
  } catch (e) { next(e); }
};

exports.addVitals = async (req, res, next) => {
  try {
    const b = req.body;
    const v = {
      temperature_c: num(b.temperature_c), pulse: int(b.pulse), respiratory_rate: int(b.respiratory_rate),
      bp_systolic: int(b.bp_systolic), bp_diastolic: int(b.bp_diastolic), spo2: int(b.spo2),
      weight_kg: num(b.weight_kg), height_cm: num(b.height_cm),
    };
    if (Object.values(v).every((x) => x === null)) return fail(res, 422, 'Enter at least one measurement');
    if ((v.bp_systolic === null) !== (v.bp_diastolic === null)) {
      return fail(res, 422, 'Enter both systolic and diastolic blood pressure');
    }
    if (v.bp_systolic !== null && v.bp_systolic <= v.bp_diastolic) {
      return fail(res, 422, 'Systolic pressure must be higher than diastolic');
    }
    const id = await service.addVitals(Number(req.params.id), v, req.user);
    await audit(req, 'ADD_VITALS', req.params.id, { vitals_id: id });
    ok(res, { id }, 'Vital signs recorded', 201);
  } catch (e) { next(e); }
};

exports.start = async (req, res, next) => {
  try {
    await service.start(Number(req.params.id), req.user);
    await audit(req, 'START_CONSULTATION', req.params.id);
    ok(res, null, 'Consultation started');
  } catch (e) { next(e); }
};

exports.saveNotes = async (req, res, next) => {
  try {
    await service.saveNotes(Number(req.params.id), req.body, req.user);
    await audit(req, 'UPDATE_NOTES', req.params.id);
    ok(res, null, 'Notes saved');
  } catch (e) { next(e); }
};

exports.addDiagnosis = async (req, res, next) => {
  try {
    const id = await service.addDiagnosis(Number(req.params.id), req.body, req.user);
    await audit(req, 'ADD_DIAGNOSIS', req.params.id, { description: req.body.description, type: req.body.type });
    ok(res, { id }, 'Diagnosis added', 201);
  } catch (e) { next(e); }
};

exports.removeDiagnosis = async (req, res, next) => {
  try {
    const removed = await service.removeDiagnosis(Number(req.params.id), Number(req.params.diagId), req.user);
    await audit(req, 'REMOVE_DIAGNOSIS', req.params.id, removed);
    ok(res, null, 'Diagnosis removed');
  } catch (e) { next(e); }
};

exports.orderLabs = async (req, res, next) => {
  try {
    const r = await service.orderLabs(Number(req.params.id), req.body, req.user);
    await audit(req, 'ORDER_LAB', req.params.id, { test_ids: req.body.test_ids, priority: req.body.priority });
    ok(res, r, 'Lab tests ordered', 201);
  } catch (e) { next(e); }
};

exports.cancelLab = async (req, res, next) => {
  try {
    await service.cancelLab(Number(req.params.id), Number(req.params.orderId), req.user);
    await audit(req, 'CANCEL_LAB', req.params.id, { order_id: req.params.orderId });
    ok(res, null, 'Lab order cancelled');
  } catch (e) { next(e); }
};

exports.prescribe = async (req, res, next) => {
  try {
    const r = await service.prescribe(Number(req.params.id), req.body, req.user);
    if (r.conflicts && !r.id) {
      return fail(res, 409, 'Possible allergy conflict', { conflicts: r.conflicts });
    }
    await audit(req, 'PRESCRIBE', req.params.id, {
      prescription_id: r.id, allergy_override: r.overridden || undefined, conflicts: r.overridden ? r.conflicts : undefined,
    });
    ok(res, { id: r.id }, 'Prescription saved', 201);
  } catch (e) { next(e); }
};

exports.cancelPrescription = async (req, res, next) => {
  try {
    await service.cancelPrescription(Number(req.params.id), Number(req.params.rxId), req.user);
    await audit(req, 'CANCEL_PRESCRIPTION', req.params.id, { prescription_id: req.params.rxId });
    ok(res, null, 'Prescription cancelled');
  } catch (e) { next(e); }
};

exports.close = async (req, res, next) => {
  try {
    const r = await service.close(Number(req.params.id), req.body.force === true, req.user);
    if (r.pending && !r.closed) {
      return fail(res, 409, `${r.pending} lab test(s) have no verified result yet`, { pending: r.pending });
    }
    await audit(req, 'COMPLETE_VISIT', req.params.id, { pending_labs: r.pending });
    ok(res, null, 'Visit completed');
  } catch (e) { next(e); }
};

exports.labTests = async (req, res, next) => {
  try { ok(res, await service.labTests()); } catch (e) { next(e); }
};
exports.medications = async (req, res, next) => {
  try { ok(res, await service.medications()); } catch (e) { next(e); }
};