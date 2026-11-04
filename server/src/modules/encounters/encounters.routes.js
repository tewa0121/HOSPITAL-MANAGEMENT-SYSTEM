const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./encounters.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const range = (field, min, max, label) =>
  body(field).optional({ checkFalsy: true }).isFloat({ min, max }).withMessage(`${label} must be between ${min} and ${max}`);

const vitalsRules = [
  range('temperature_c', 30, 45, 'Temperature'),
  range('pulse', 20, 250, 'Pulse'),
  range('respiratory_rate', 5, 80, 'Respiratory rate'),
  range('bp_systolic', 40, 300, 'Systolic pressure'),
  range('bp_diastolic', 20, 200, 'Diastolic pressure'),
  range('spo2', 50, 100, 'SpO2'),
  range('weight_kg', 0.3, 500, 'Weight'),
  range('height_cm', 20, 250, 'Height'),
];

const text = (f, max = 5000) => body(f).optional({ checkFalsy: true }).isString().isLength({ max }).withMessage(`${f} is too long`);
const notesRules = [
  text('chief_complaint'), text('history_present_illness'), text('examination'), text('treatment_plan'),
  body('follow_up_date').optional({ checkFalsy: true }).isISO8601({ strict: true }).withMessage('Invalid follow-up date')
    .bail().custom((v) => v >= today()).withMessage('Follow-up date cannot be in the past'),
];

const diagnosisRules = [
  body('description').trim().notEmpty().withMessage('Diagnosis description is required').isLength({ max: 255 }),
  body('icd10_code').optional({ checkFalsy: true }).trim().matches(/^[A-Za-z]\d{2}(\.\w{1,4})?$/)
    .withMessage('ICD-10 code looks invalid, e.g. B54 or A01.0'),
  body('type').optional().isIn(['primary', 'secondary']).withMessage('Invalid diagnosis type'),
];

const labRules = [
  body('test_ids').isArray({ min: 1, max: 20 }).withMessage('Select at least one test'),
  body('test_ids.*').isInt({ min: 1 }).withMessage('Invalid test'),
  body('priority').optional().isIn(['routine', 'urgent']).withMessage('Invalid priority'),
];

const rxRules = [
  body('items').isArray({ min: 1, max: 10 }).withMessage('Add at least one medication'),
  body('items.*.medication_id').isInt({ min: 1 }).withMessage('Select a medication'),
  body('items.*.dosage').trim().notEmpty().withMessage('Dosage is required').isLength({ max: 60 }),
  body('items.*.frequency').trim().notEmpty().withMessage('Frequency is required').isLength({ max: 60 }),
  body('items.*.duration_days').isInt({ min: 1, max: 365 }).withMessage('Duration must be 1-365 days'),
  body('items.*.quantity').isInt({ min: 1, max: 10000 }).withMessage('Quantity must be at least 1'),
  body('items.*.instructions').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  body('override').optional().isBoolean(),
];

const closeRules = [body('force').optional().isBoolean()];

const digits = (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id'));

router.use(authenticate);
['id', 'diagId', 'orderId', 'rxId'].forEach((p) => router.param(p, digits));

router.get('/lookups/lab-tests', requirePermission('lab.order'), ctrl.labTests);
router.get('/lookups/medications', requirePermission('prescriptions.create'), ctrl.medications);

router.get('/', requirePermission('encounters.read'), ctrl.list);
router.get('/:id', requirePermission('encounters.read'), ctrl.get);

router.post('/:id/vitals', requirePermission('vitals.create'), vitalsRules, validate, ctrl.addVitals);
router.patch('/:id/start', requirePermission('encounters.update'), ctrl.start);
router.put('/:id/notes', requirePermission('encounters.update'), notesRules, validate, ctrl.saveNotes);

router.post('/:id/diagnoses', requirePermission('diagnoses.create'), diagnosisRules, validate, ctrl.addDiagnosis);
router.delete('/:id/diagnoses/:diagId', requirePermission('diagnoses.create'), ctrl.removeDiagnosis);

router.post('/:id/lab-orders', requirePermission('lab.order'), labRules, validate, ctrl.orderLabs);
router.patch('/:id/lab-orders/:orderId/cancel', requirePermission('lab.order'), ctrl.cancelLab);

router.post('/:id/prescriptions', requirePermission('prescriptions.create'), rxRules, validate, ctrl.prescribe);
router.patch('/:id/prescriptions/:rxId/cancel', requirePermission('prescriptions.create'), ctrl.cancelPrescription);

router.patch('/:id/close', requirePermission('encounters.close'), closeRules, validate, ctrl.close);

module.exports = router;