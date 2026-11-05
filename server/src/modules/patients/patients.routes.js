const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./patients.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission, requireAny } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const PHONE_RE = /^(\+251|251|0)?[79]\d{8}$/;
const stripSpaces = (v) => String(v).replace(/[\s-]/g, '');
const phoneMsg = 'Enter a valid Ethiopian phone number, e.g. 0911223344 or +251911223344';

const patientRules = [
  body('first_name').trim().notEmpty().withMessage('First name is required').isLength({ max: 60 }),
  body('father_name').trim().notEmpty().withMessage("Father's name is required").isLength({ max: 60 }),
  body('grandfather_name').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('gender').isIn(['male', 'female']).withMessage('Select a gender'),
  body('date_of_birth').isISO8601({ strict: true }).withMessage('A valid date of birth is required')
    .bail().custom((v) => new Date(v) <= new Date()).withMessage('Date of birth cannot be in the future'),
  body('phone').optional({ checkFalsy: true }).customSanitizer(stripSpaces).matches(PHONE_RE).withMessage(phoneMsg),
  body('blood_group').optional({ checkFalsy: true })
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).withMessage('Invalid blood group'),
  body('marital_status').optional({ checkFalsy: true })
    .isIn(['single', 'married', 'divorced', 'widowed']).withMessage('Invalid marital status'),
  body('emergency_contact.phone').optional({ checkFalsy: true })
    .customSanitizer(stripSpaces).matches(PHONE_RE).withMessage(phoneMsg),
  body('emergency_contact').custom((c) => {
    if (!c) return true;
    const hasName = !!(c.full_name && String(c.full_name).trim());
    const hasPhone = !!(c.phone && String(c.phone).trim());
    if (hasName !== hasPhone) throw new Error('Emergency contact needs both a name and a phone number');
    return true;
  }),
];

const allergyRules = [
  body('allergen').trim().notEmpty().withMessage('Allergen is required').isLength({ max: 100 }),
  body('severity').optional().isIn(['mild', 'moderate', 'severe']).withMessage('Invalid severity'),
  body('reaction').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
];

// Doctors, nurses and registration staff may record allergies
const canEditAllergies = requireAny('encounters.update', 'vitals.create', 'patients.update');

router.use(authenticate);
router.param('id', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));
router.param('allergyId', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));

router.get('/', requirePermission('patients.read'), ctrl.list);
router.get('/:id', requirePermission('patients.read'), ctrl.get);
router.post('/', requirePermission('patients.create'), patientRules, validate, ctrl.create);
router.put('/:id', requirePermission('patients.update'), patientRules, validate, ctrl.update);
router.delete('/:id', requirePermission('patients.delete'), ctrl.remove);

router.post('/:id/allergies', canEditAllergies, allergyRules, validate, ctrl.addAllergy);
router.delete('/:id/allergies/:allergyId', canEditAllergies, ctrl.removeAllergy);

module.exports = router;