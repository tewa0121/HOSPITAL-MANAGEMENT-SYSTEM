const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./roles.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const asText = (v) => (v === undefined || v === null ? '' : String(v));

const names = [
  body('display_name').trim().isLength({ min: 2, max: 100 }).withMessage('Role name must be 2-100 characters'),
  body('display_name_am').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Amharic name is too long'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('Description is too long'),
];
const createRules = [
  body('name').customSanitizer((v) => asText(v).trim().toLowerCase())
    .matches(/^[a-z][a-z0-9_]{2,39}$/).withMessage('Key must be 3-40 characters: lowercase letters, digits or underscore, starting with a letter'),
  body('copy_from').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Invalid role to copy'),
  ...names,
];
const permRules = [
  body('permission_ids').isArray({ max: 200 }).withMessage('Invalid permissions'),
  body('permission_ids.*').isInt({ min: 1 }).withMessage('Invalid permission'),
];

router.use(authenticate);
router.param('id', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));

router.get('/', requirePermission('roles.read'), ctrl.list);
router.get('/:id', requirePermission('roles.read'), ctrl.get);
router.post('/', requirePermission('roles.manage'), createRules, validate, ctrl.create);
router.put('/:id', requirePermission('roles.manage'), names, validate, ctrl.update);
router.put('/:id/permissions', requirePermission('roles.manage'), permRules, validate, ctrl.setPermissions);
router.delete('/:id', requirePermission('roles.manage'), ctrl.remove);

module.exports = router;