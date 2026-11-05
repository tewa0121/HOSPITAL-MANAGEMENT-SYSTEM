const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./pharmacy.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Infusion', 'Sachet', 'Cream', 'Ointment', 'Drops', 'Inhaler'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const asText = (v) => (v === undefined || v === null ? '' : String(v));

const dispenseRules = [
  body('items').isArray({ min: 1, max: 20 }).withMessage('Select at least one medication to dispense'),
  body('items.*.item_id').isInt({ min: 1 }).withMessage('Invalid medication'),
  body('items.*.quantity').isInt({ min: 0, max: 100000 }).withMessage('Quantity must be a whole number'),
  body('override').optional().isBoolean(),
  body('override_reason').optional({ checkFalsy: true }).trim().isLength({ max: 200 }).withMessage('Reason is too long'),
];

const receiveRules = [
  body('medication_id').isInt({ min: 1 }).withMessage('Select a medication'),
  body('batch_no').customSanitizer((v) => asText(v).trim().toUpperCase())
    .matches(/^[A-Z0-9][A-Z0-9._/-]{1,39}$/).withMessage('Batch number must be 2-40 characters (letters, digits, - . / _)'),
  body('expiry_date').matches(DATE_RE).withMessage('A valid expiry date is required')
    .bail().isISO8601({ strict: true }).withMessage('A valid expiry date is required'),
  body('quantity').isInt({ min: 1, max: 1000000 }).withMessage('Quantity must be at least 1'),
];

const adjustRules = [
  body('reason_type').isIn(['damaged', 'expired', 'lost', 'count_correction']).withMessage('Select a reason'),
  body('quantity').isInt({ min: 1, max: 1000000 }).withMessage('Quantity must be at least 1'),
  body('note').optional({ checkFalsy: true }).trim().isLength({ max: 200 }).withMessage('Note is too long'),
];

const medicationRules = [
  body('generic_name').trim().notEmpty().withMessage('Medication name is required').isLength({ max: 120 }),
  body('brand_name').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('form').isIn(FORMS).withMessage('Select a dosage form'),
  body('strength').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('unit_price').isFloat({ min: 0, max: 1000000 }).withMessage('Price must be 0 or more'),
  body('reorder_level').isInt({ min: 0, max: 1000000 }).withMessage('Reorder level must be 0 or more'),
  body('is_controlled').optional().isBoolean(),
  body('is_active').optional().isBoolean(),
];

const digits = (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id'));

router.use(authenticate);
['id', 'medId', 'batchId'].forEach((p) => router.param(p, digits));

router.get('/prescriptions', requirePermission('prescriptions.read'), ctrl.prescriptions);
router.get('/prescriptions/:id', requirePermission('prescriptions.read'), ctrl.prescription);
router.post('/prescriptions/:id/dispense', requirePermission('prescriptions.dispense'), dispenseRules, validate, ctrl.dispense);

router.get('/stock', requirePermission('pharmacy.stock_read'), ctrl.stock);
router.post('/stock/receive', requirePermission('pharmacy.stock_manage'), receiveRules, validate, ctrl.receive);
router.get('/stock/:medId/batches', requirePermission('pharmacy.stock_read'), ctrl.batches);
router.patch('/stock/batches/:batchId/adjust', requirePermission('pharmacy.stock_manage'), adjustRules, validate, ctrl.adjust);

router.post('/medications', requirePermission('pharmacy.stock_manage'), medicationRules, validate, ctrl.createMedication);
router.put('/medications/:id', requirePermission('pharmacy.stock_manage'), medicationRules, validate, ctrl.updateMedication);

module.exports = router;