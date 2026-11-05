const service = require('./wards.service');
const { ok } = require('../../utils/response');
const { logAudit } = require('../../middleware/audit');

const audit = (req, action, recordId, details) =>
  logAudit({ userId: req.user.id, action, module: 'wards', recordId, details, ip: req.ip });

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.board = wrap(async (req, res) => ok(res, await service.board(req.user)));

exports.availableBeds = wrap(async (req, res) => {
  ok(res, await service.availableBeds(req.query.patient_id ? Number(req.query.patient_id) : null));
});

exports.createWard = wrap(async (req, res) => {
  const id = await service.createWard(req.body);
  await audit(req, 'CREATE_WARD', id, { code: req.body.code, name: req.body.name, rate: req.body.daily_rate, beds: req.body.beds });
  ok(res, { id }, 'Ward created', 201);
});

exports.updateWard = wrap(async (req, res) => {
  const r = await service.updateWard(Number(req.params.id), req.body);
  await audit(req, 'UPDATE_WARD', req.params.id, r);
  ok(res, null, 'Ward updated');
});

exports.addBeds = wrap(async (req, res) => {
  const r = await service.addBeds(Number(req.params.id), Number(req.body.count));
  await audit(req, 'ADD_BEDS', req.params.id, r);
  ok(res, r, 'Beds added', 201);
});

exports.bedStatus = wrap(async (req, res) => {
  const r = await service.setBedStatus(Number(req.params.bedId), req.body.status);
  await audit(req, 'BED_STATUS', req.params.bedId, r);
  ok(res, null, 'Bed status updated');
});

exports.list = wrap(async (req, res) => ok(res, await service.listAdmissions(req.query, req.user)));

exports.get = wrap(async (req, res) => {
  const data = await service.admissionDetail(Number(req.params.id), req.user);
  await audit(req, 'VIEW_ADMISSION', req.params.id, { patient_id: data.patient_id });
  ok(res, data);
});

exports.admit = wrap(async (req, res) => {
  const r = await service.admit(req.body, req.user);
  await audit(req, 'ADMIT', r.id, { patient_id: req.body.patient_id, encounter_id: req.body.encounter_id, bed: r.bed, ward: r.ward });
  ok(res, r, 'Patient admitted', 201);
});

exports.transfer = wrap(async (req, res) => {
  const r = await service.transfer(Number(req.params.id), req.body, req.user);
  await audit(req, 'TRANSFER', req.params.id, r);
  ok(res, r, 'Patient transferred');
});

exports.discharge = wrap(async (req, res) => {
  const r = await service.discharge(Number(req.params.id), req.body, req.user);
  await audit(req, 'DISCHARGE', req.params.id, { bed: r.bed, patient_id: r.patient_id });
  ok(res, null, 'Patient discharged');
});

exports.addNote = wrap(async (req, res) => {
  const r = await service.addNote(Number(req.params.id), req.body, req.user);
  await audit(req, 'ADD_NOTE', req.params.id, { note_id: r.id, type: r.type });
  ok(res, r, 'Note added', 201);
});