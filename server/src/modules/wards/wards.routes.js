const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./wards.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission, requireAny } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const asText = (v) => (v === undefined || v === null ? '' : String(v));

const rate = body('daily_rate').custom((v) => {
  const n = Number(v);
  if (v === '' || v === null || Number.isNaN(n) || n < 0 || n > 1000000 || Math.round(n * 100) / 100 !== n) {
    throw new Error('Daily rate must be 0 or more with at most 2 decimals');
  }
  return true;
});

const wardBase = [
  body('name').trim().notEmpty().withMessage('Ward name is required').isLength({ max: 80 }),
  body('name_am').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  rate,
  body('is_active').optional().isBoolean(),
];
const createWardRules = [
  body('code').customSanitizer((v) => asText(v).trim().toUpperCase())
    .matches(/^[A-Z0-9]{2,10}$/).withMessage('Code must be 2-10 letters or digits'),
  body('beds').optional({ checkFalsy: true }).isInt({ min: 0, max: 50 }).withMessage('Beds must be 0-50'),
  ...wardBase,
];
const bedsRules = [body('count').isInt({ min: 1, max: 30 }).withMessage('Add between 1 and 30 beds')];
const bedStatusRules = [body('status').isIn(['available', 'maintenance']).withMessage('Invalid bed status')];

const reason = (field, min = 3, max = 255, label = 'Reason') =>
  body(field).customSanitizer(asText).trim().isLength({ min, max }).withMessage(`${label} must be ${min}-${max} characters`);

const admitRules = [
  body('patient_id').isInt({ min: 1 }).withMessage('Select a patient'),
  body('bed_id').isInt({ min: 1 }).withMessage('Select a bed'),
  body('encounter_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Invalid visit'),
  reason('reason', 3, 255, 'Reason for admission'),
];
const transferRules = [body('bed_id').isInt({ min: 1 }).withMessage('Select a bed'), reason('reason', 3, 200)];
const dischargeRules = [reason('summary', 10, 5000, 'Discharge summary')];
const noteRules = [reason('note', 3, 2000, 'Note')];

const digits = (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id'));

router.use(authenticate);
['id', 'bedId'].forEach((p) => router.param(p, digits));

router.get('/board', requirePermission('wards.read'), ctrl.board);
router.get('/beds/available', requirePermission('admissions.create'), ctrl.availableBeds);
router.patch('/beds/:bedId/status', requirePermission('wards.bed_status'), bedStatusRules, validate, ctrl.bedStatus);

router.post('/', requirePermission('wards.manage'), createWardRules, validate, ctrl.createWard);
router.put('/:id', requirePermission('wards.manage'), wardBase, validate, ctrl.updateWard);
router.post('/:id/beds', requirePermission('wards.manage'), bedsRules, validate, ctrl.addBeds);

router.get('/admissions', requirePermission('admissions.read'), ctrl.list);
router.get('/admissions/:id', requirePermission('admissions.read'), ctrl.get);
router.post('/admissions', requirePermission('admissions.create'), admitRules, validate, ctrl.admit);
router.patch('/admissions/:id/transfer', requirePermission('admissions.create'), transferRules, validate, ctrl.transfer);
router.patch('/admissions/:id/discharge', requirePermission('admissions.discharge'), dischargeRules, validate, ctrl.discharge);
router.post('/admissions/:id/notes', requireAny('encounters.update', 'vitals.create'), noteRules, validate, ctrl.addNote);

module.exports = router;