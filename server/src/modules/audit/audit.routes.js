const router = require('express').Router();
const ctrl = require('./audit.controller');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

// read-only: there is no route anywhere that edits or deletes an audit entry
router.use(authenticate, requirePermission('audit.read'));
router.get('/', ctrl.list);
router.get('/filters', ctrl.filters);
router.get('/logins', ctrl.logins);

module.exports = router;