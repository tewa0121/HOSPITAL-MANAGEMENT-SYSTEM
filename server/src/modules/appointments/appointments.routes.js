const router = require('express').Router();
const { body, query } = require('express-validator');
const ctrl = require('./appointments.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:00)?$/;

const isWalkIn = (req) => req.body.type === 'walk_in';

const createRules = [
  body('patient_id').isInt({ min: 1 }).withMessage('Select a patient'),
  body('doctor_id').isInt({ min: 1 }).withMessage('Select a doctor'),
  body('type').optional().isIn(['scheduled', 'walk_in']),
  body('appointment_date').custom((v, { req }) => isWalkIn(req) || DATE_RE.test(v || ''))
    .withMessage('A valid date is required'),
  body('start_time').custom((v, { req }) => isWalkIn(req) || TIME_RE.test(v || ''))
    .withMessage('A valid time is required'),
  body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
];

const rescheduleRules = [
  body('appointment_date').matches(DATE_RE).withMessage('A valid date is required'),
  body('start_time').matches(TIME_RE).withMessage('A valid time is required'),
];

const slotRules = [
  query('doctor_id').isInt({ min: 1 }).withMessage('doctor_id is required'),
  query('date').matches(DATE_RE).withMessage('date is required (YYYY-MM-DD)'),
];

router.use(authenticate);
router.param('id', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));

router.get('/doctors', requirePermission('appointments.read'), ctrl.doctors);
router.get('/slots', requirePermission('appointments.read'), slotRules, validate, ctrl.slots);
router.get('/', requirePermission('appointments.read'), ctrl.list);
router.post('/', requirePermission('appointments.create'), createRules, validate, ctrl.create);

router.patch('/:id/check-in', requirePermission('appointments.checkin'), ctrl.checkIn);
router.patch('/:id/cancel', requirePermission('appointments.cancel'), ctrl.cancel);
router.patch('/:id/reschedule', requirePermission('appointments.update'), rescheduleRules, validate, ctrl.reschedule);
router.patch('/:id/no-show', requirePermission('appointments.update'), ctrl.noShow);

module.exports = router;