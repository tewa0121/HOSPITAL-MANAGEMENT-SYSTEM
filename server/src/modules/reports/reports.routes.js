const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('./reports.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { fail } = require('../../utils/response');
const { SECTION_NAMES } = require('./reports.service');

// each section needs its own permission on top of reports.read
const ACCESS = {
  overview: ['reports.hospital'], clinical: ['reports.hospital'], lab: ['reports.hospital'], inpatient: ['reports.hospital'],
  finance: ['billing.invoice_read'], pharmacy: ['pharmacy.stock_read'],
};

const sectionGuard = (req, res, next) => {
  const need = ACCESS[req.params.section];
  if (!need) return fail(res, 404, 'Unknown report');
  return requirePermission(...need)(req, res, next);
};

const exportRules = [
  body('section').isIn(SECTION_NAMES).withMessage('Unknown report'),
  body('from').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid start date'),
  body('to').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid end date'),
];

router.use(authenticate);

router.get('/dashboard', requirePermission('dashboard.view'), ctrl.dashboard);
router.post('/export-log', requirePermission('reports.read', 'reports.export'), exportRules, validate, ctrl.exportLog);
router.get('/:section', requirePermission('reports.read'), sectionGuard, ctrl.section);

module.exports = router;