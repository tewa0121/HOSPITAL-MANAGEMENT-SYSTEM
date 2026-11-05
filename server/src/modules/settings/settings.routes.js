const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./settings.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const asText = (v) => (v === undefined || v === null ? '' : String(v));

const rules = [
  body('hospital_name').trim().isLength({ min: 2, max: 100 }).withMessage('Hospital name must be 2-100 characters'),
  body('hospital_name_am').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Amharic name is too long'),
  body('mrn_prefix').customSanitizer((v) => asText(v).trim().toUpperCase())
    .matches(/^[A-Z0-9]{2,6}$/).withMessage('MRN prefix must be 2-6 letters or digits'),
  body('appointment_slot_minutes').customSanitizer(asText).isIn(['10', '15', '20', '30', '45', '60'])
    .withMessage('Choose 10, 15, 20, 30, 45 or 60 minutes'),
  body('default_language').isIn(['en', 'am']).withMessage('Invalid language'),
];

router.get('/public', ctrl.publicInfo); // no login: only the hospital name and default language

router.use(authenticate);
router.get('/', requirePermission('settings.manage'), ctrl.get);
router.put('/', requirePermission('settings.manage'), rules, validate, ctrl.update);

module.exports = router;