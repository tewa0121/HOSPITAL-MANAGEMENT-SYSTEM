const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./lab.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission, requireAny } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const asText = (v) => (v === undefined || v === null ? '' : String(v));

const resultRules = [
  body('result_value').customSanitizer(asText).trim().notEmpty().withMessage('Result is required')
    .isLength({ max: 100 }).withMessage('Result is too long'),
  body('result_flag').optional({ checkFalsy: true }).isIn(['normal', 'high', 'critical']).withMessage('Invalid interpretation'),
  body('result_comment').optional({ checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('Comment is too long'),
];

const rejectRules = [
  body('reason').customSanitizer(asText).trim().isLength({ min: 3, max: 200 })
    .withMessage('Enter a reason (3-200 characters)'),
];

const catalogBase = [
  body('name').trim().notEmpty().withMessage('Test name is required').isLength({ max: 120 }),
  body('category').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('specimen').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('unit').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('ref_low').optional({ checkFalsy: true }).isFloat().withMessage('Reference low must be a number'),
  body('ref_high').optional({ checkFalsy: true }).isFloat().withMessage('Reference high must be a number'),
  body('ref_text').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('price').isFloat({ min: 0 }).withMessage('Price must be 0 or more'),
  body('is_active').optional().isBoolean(),
];

const createRules = [
  body('code').customSanitizer((v) => asText(v).trim().toUpperCase())
    .matches(/^[A-Z0-9]{2,12}$/).withMessage('Code must be 2-12 letters or digits'),
  ...catalogBase,
];

router.use(authenticate);
router.param('id', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));

router.get('/orders', requirePermission('lab.read'), ctrl.list);

router.patch('/orders/:id/collect', requirePermission('lab.collect'), ctrl.collect);
router.patch('/orders/:id/start', requirePermission('lab.enter_result'), ctrl.start);
router.put('/orders/:id/result', requirePermission('lab.enter_result'), resultRules, validate, ctrl.saveResult);
router.patch('/orders/:id/verify', requirePermission('lab.verify'), ctrl.verify);
router.patch('/orders/:id/reject', requireAny('lab.collect', 'lab.enter_result'), rejectRules, validate, ctrl.reject);

router.get('/catalog', requirePermission('lab.read'), ctrl.catalog);
router.post('/catalog', requirePermission('lab.manage_catalog'), createRules, validate, ctrl.createTest);
router.put('/catalog/:id', requirePermission('lab.manage_catalog'), catalogBase, validate, ctrl.updateTest);

module.exports = router;