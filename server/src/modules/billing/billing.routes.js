const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./billing.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const METHODS = ['cash', 'telebirr', 'cbe_birr', 'bank_transfer'];

// positive amount with at most 2 decimals
const money = (field) => body(field).custom((v) => {
  const n = Number(v);
  if (v === '' || v === null || !(n > 0) || n > 10000000 || Math.round(n * 100) / 100 !== n) {
    throw new Error('Amount must be greater than 0 with at most 2 decimals');
  }
  return true;
});

const reason = (field = 'reason', max = 200) => body(field).customSanitizer((v) => (v === undefined || v === null ? '' : String(v))).trim()
  .isLength({ min: 3, max }).withMessage(`Enter a reason (3-${max} characters)`);

const createRules = [
  body('encounter_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Invalid visit'),
  body('admission_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Invalid admission'),
  body().custom((_, { req }) => {
    if (!!req.body.encounter_id === !!req.body.admission_id) throw new Error('Select a visit or an admission');
    return true;
  }),
];

const payRules = [
  money('amount'),
  body('method').isIn(METHODS).withMessage('Select a payment method'),
  body('reference').optional({ checkFalsy: true }).trim().isLength({ max: 60 }).withMessage('Reference is too long')
    .matches(/^[A-Za-z0-9._/-]+$/).withMessage('Reference can contain letters, digits and - . / _ only'),
];

const refundRules = [
  money('amount'),
  body('method').isIn(METHODS).withMessage('Select how the money is returned'),
  reason('reason', 60),
];

const discountRules = [
  body('type').isIn(['percent', 'amount']).withMessage('Select the discount type'),
  body('value').custom((v, { req }) => {
    const n = Number(v);
    if (v === '' || v === null || Number.isNaN(n) || n < 0) throw new Error('Enter 0 or a positive value');
    if (req.body.type === 'percent' && n > 100) throw new Error('A percentage cannot be higher than 100');
    if (Math.round(n * 100) / 100 !== n) throw new Error('At most 2 decimals');
    return true;
  }),
  reason(),
];

const cancelRules = [reason()];

// Define itemRules to fix ReferenceError
const itemRules = [
  body('service_id').isInt({ min: 1 }).withMessage('Valid service is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

const digits = (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id'));

router.use(authenticate);
['id', 'itemId'].forEach((p) => router.param(p, digits));

router.get('/summary', requirePermission('billing.invoice_read'), ctrl.summary);
router.get('/unbilled', requirePermission('billing.invoice_create'), ctrl.unbilled);
router.get('/unbilled-admissions', requirePermission('billing.invoice_create'), ctrl.unbilledAdmissions);
router.get('/services', requirePermission('billing.invoice_create'), ctrl.services);

router.get('/invoices', requirePermission('billing.invoice_read'), ctrl.list);
router.get('/invoices/:id', requirePermission('billing.invoice_read'), ctrl.get);
router.post('/invoices', requirePermission('billing.invoice_create'), createRules, validate, ctrl.create);
router.patch('/invoices/:id/sync', requirePermission('billing.invoice_create'), ctrl.sync);
router.post('/invoices/:id/items', requirePermission('billing.invoice_create'), itemRules, validate, ctrl.addItem);
router.delete('/invoices/:id/items/:itemId', requirePermission('billing.invoice_create'), ctrl.removeItem);
router.patch('/invoices/:id/cancel', requirePermission('billing.invoice_create'), cancelRules, validate, ctrl.cancel);

router.post('/invoices/:id/payments', requirePermission('billing.payment_create'), payRules, validate, ctrl.pay);
router.post('/invoices/:id/refund', requirePermission('billing.refund'), refundRules, validate, ctrl.refund);
router.patch('/invoices/:id/discount', requirePermission('billing.discount_apply'), discountRules, validate, ctrl.discount);

module.exports = router;