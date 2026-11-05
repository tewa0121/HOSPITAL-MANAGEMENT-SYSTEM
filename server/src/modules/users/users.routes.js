const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./users.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const PHONE_RE = /^(\+251|251|0)?[79]\d{8}$/;
const asText = (v) => (v === undefined || v === null ? '' : String(v));
const stripSpaces = (v) => asText(v).replace(/[\s-]/g, '');

const base = [
  body('full_name').trim().isLength({ min: 3, max: 120 }).withMessage('Full name must be 3-120 characters'),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Enter a valid email address')
    .isLength({ max: 120 }).withMessage('Email is too long'),
  body('phone').optional({ checkFalsy: true }).customSanitizer(stripSpaces).matches(PHONE_RE)
    .withMessage('Enter a valid Ethiopian phone number, e.g. 0911223344'),
  body('role_id').isInt({ min: 1 }).withMessage('Select a role'),
  body('department_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Invalid department'),
];

const createRules = [
  body('username').customSanitizer((v) => asText(v).trim().toLowerCase())
    .matches(/^[a-z0-9._]{3,30}$/).withMessage('Username must be 3-30 characters: lowercase letters, digits, dot or underscore'),
  ...base,
];

const statusRules = [body('is_active').isBoolean().withMessage('Invalid status').toBoolean()];

const overrideRules = [
  body('overrides').isArray({ max: 200 }).withMessage('Invalid overrides'),
  body('overrides.*.permission_id').isInt({ min: 1 }).withMessage('Invalid permission'),
  body('overrides.*.is_granted').isBoolean().withMessage('Invalid override').toBoolean(),
];

router.use(authenticate);
router.param('id', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));

router.get('/', requirePermission('users.read'), ctrl.list);
router.get('/lookups', requirePermission('users.read'), ctrl.lookups);
router.post('/', requirePermission('users.create'), createRules, validate, ctrl.create);
router.put('/:id', requirePermission('users.update'), base, validate, ctrl.update);
router.patch('/:id/status', requirePermission('users.update'), statusRules, validate, ctrl.status);
router.patch('/:id/unlock', requirePermission('users.update'), ctrl.unlock);
router.post('/:id/reset-password', requirePermission('users.update'), ctrl.resetPassword);

router.get('/:id/permissions', requirePermission('roles.manage'), ctrl.getPermissions);
router.put('/:id/permissions', requirePermission('roles.manage'), overrideRules, validate, ctrl.setPermissions);

module.exports = router;