const service = require('./appointments.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'appointments', recordId, details, ip: req.ip });

exports.doctors = async (req, res, next) => {
  try { ok(res, await service.listDoctors()); } catch (e) { next(e); }
};

exports.slots = async (req, res, next) => {
  try { ok(res, await service.getSlots(Number(req.query.doctor_id), req.query.date)); } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    // Resource-level rule: a doctor only sees their own appointments
    if (req.user.role === 'doctor') filters.doctor_id = req.user.id;
    ok(res, await service.list(filters));
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const result = await service.create(req.body, req.user.id);
    await audit(req, 'CREATE', result.id, { type: req.body.type || 'scheduled', patient_id: req.body.patient_id });
    ok(res, result, 'Appointment created', 201);
  } catch (e) { next(e); }
};

exports.checkIn = async (req, res, next) => {
  try {
    const result = await service.checkIn(Number(req.params.id));
    await audit(req, 'CHECK_IN', req.params.id, { queue_number: result.queue_number });
    ok(res, result, 'Patient checked in');
  } catch (e) { next(e); }
};

exports.cancel = async (req, res, next) => {
  try {
    await service.cancel(Number(req.params.id));
    await audit(req, 'CANCEL', req.params.id);
    ok(res, null, 'Appointment cancelled');
  } catch (e) { next(e); }
};

exports.reschedule = async (req, res, next) => {
  try {
    await service.reschedule(Number(req.params.id), req.body);
    await audit(req, 'RESCHEDULE', req.params.id, req.body);
    ok(res, null, 'Appointment rescheduled');
  } catch (e) { next(e); }
};

exports.noShow = async (req, res, next) => {
  try {
    await service.noShow(Number(req.params.id));
    await audit(req, 'NO_SHOW', req.params.id);
    ok(res, null, 'Marked as no-show');
  } catch (e) { next(e); }
};