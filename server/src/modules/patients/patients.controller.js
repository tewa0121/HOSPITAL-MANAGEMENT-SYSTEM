const service = require('./patients.service');
const { ok, fail } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

exports.list = async (req, res, next) => {
  try {
    const data = await service.list({
      search: (req.query.search || '').trim(),
      status: req.query.status,
      page: Math.max(Number(req.query.page) || 1, 1),
      limit: Math.min(Math.max(Number(req.query.limit) || 10, 1), 100),
    });
    ok(res, data);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const has = (...codes) => codes.some((c) => req.user.permissions.includes(c));

    // Each section is only loaded if the user is allowed to see it
    const patient = await service.getById(id, {
      allergies: has('encounters.read', 'vitals.read', 'prescriptions.read', 'lab.read', 'patients.update'),
      appointments: has('appointments.read'),
      visits: has('encounters.read'),
    });
    await logAudit({ userId: req.user.id, action: 'VIEW', module: 'patients', recordId: id, ip: req.ip });
    ok(res, patient);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const result = await service.create(req.body, req.user.id, req.body.force === true);
    if (result.duplicates) {
      return fail(res, 409, 'Possible duplicate patient found', { duplicates: result.duplicates });
    }
    await logAudit({
      userId: req.user.id, action: 'CREATE', module: 'patients',
      recordId: result.patient.id, details: { mrn: result.patient.mrn }, ip: req.ip,
    });
    ok(res, result.patient, 'Patient registered', 201);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await service.update(id, req.body);
    await logAudit({ userId: req.user.id, action: 'UPDATE', module: 'patients', recordId: id, ip: req.ip });
    ok(res, null, 'Patient updated');
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await service.deactivate(id);
    await logAudit({ userId: req.user.id, action: 'DEACTIVATE', module: 'patients', recordId: id, ip: req.ip });
    ok(res, null, 'Patient deactivated');
  } catch (e) { next(e); }
};

exports.addAllergy = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const allergyId = await service.addAllergy(id, req.body, req.user.id);
    await logAudit({
      userId: req.user.id, action: 'ADD_ALLERGY', module: 'patients', recordId: id,
      details: { allergen: req.body.allergen, severity: req.body.severity }, ip: req.ip,
    });
    ok(res, { id: allergyId }, 'Allergy added', 201);
  } catch (e) { next(e); }
};

exports.removeAllergy = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const removed = await service.removeAllergy(id, Number(req.params.allergyId));
    await logAudit({
      userId: req.user.id, action: 'REMOVE_ALLERGY', module: 'patients', recordId: id,
      details: removed, ip: req.ip,
    });
    ok(res, null, 'Allergy removed');
  } catch (e) { next(e); }
};