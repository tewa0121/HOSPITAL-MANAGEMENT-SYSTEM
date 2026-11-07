const router = require('express').Router();
const { body } = require('express-validator');
const pool = require('../../config/db');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { logAudit } = require('../../middleware/audit');
const { ok, fail } = require('../../utils/response');
const appointments = require('../appointments/appointments.service');

const STATUSES = ['new', 'contacted', 'scheduled', 'cancelled'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:00)?$/;

router.use(authenticate);
router.param('id', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));

const canHandle = requirePermission('appointments.requests');

// List (new requests first)
router.get('/', canHandle, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = [];
    const args = [];
    if (STATUSES.includes(status)) { where.push('r.status = ?'); args.push(status); }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      where.push('(r.full_name LIKE ? OR r.phone LIKE ? OR r.reference LIKE ?)');
      args.push(s, s, s);
    }
    const [items] = await pool.query(
      `SELECT r.id, r.reference, r.full_name, r.phone, r.department, r.preferred_date, r.message,
              r.status, r.staff_note, r.created_at, r.handled_at, r.appointment_id,
              u.full_name AS handled_by_name
       FROM appointment_requests r
       LEFT JOIN users u ON u.id = r.handled_by
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY (r.status = 'new') DESC, r.created_at DESC LIMIT 300`,
      args
    );
    const [rows] = await pool.query('SELECT status, COUNT(*) AS n FROM appointment_requests GROUP BY status');
    ok(res, { items, counts: Object.fromEntries(rows.map((c) => [c.status, c.n])) });
  } catch (e) { next(e); }
});

// new / contacted / cancelled (scheduled is only set by the schedule action below)
router.patch(
  '/:id/status', canHandle,
  [
    body('status').isIn(['new', 'contacted', 'cancelled']).withMessage('Invalid status'),
    body('note').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const [r] = await pool.query(
        `UPDATE appointment_requests
         SET status = ?, staff_note = COALESCE(?, staff_note), handled_by = ?, handled_at = NOW()
         WHERE id = ? AND status <> 'scheduled'`,
        [req.body.status, req.body.note || null, req.user.id, req.params.id]
      );
      if (!r.affectedRows) return fail(res, 409, 'Request not found or already scheduled');
      await logAudit({ userId: req.user.id, action: 'UPDATE', module: 'appointments', recordId: req.params.id, details: { request_status: req.body.status }, ip: req.ip });
      return ok(res, null, 'Request updated');
    } catch (e) { return next(e); }
  }
);

// Turn a request into a real appointment (same booking rules as the normal form)
router.post(
  '/:id/schedule', canHandle, requirePermission('appointments.create'),
  [
    body('patient_id').isInt({ min: 1 }).withMessage('Select a patient'),
    body('doctor_id').isInt({ min: 1 }).withMessage('Select a doctor'),
    body('appointment_date').matches(DATE_RE).withMessage('A valid date is required'),
    body('start_time').matches(TIME_RE).withMessage('A valid time is required'),
  ],
  validate,
  async (req, res, next) => {
    const id = Number(req.params.id);
    let prevStatus = null;
    let claimed = false;
    let created = false;
    try {
      const [[row]] = await pool.query('SELECT * FROM appointment_requests WHERE id = ?', [id]);
      if (!row) return fail(res, 404, 'Request not found');
      prevStatus = row.status;

      // Claim the request first, so two receptionists cannot book it twice
      const [c] = await pool.query(
        `UPDATE appointment_requests SET status = 'scheduled', handled_by = ?, handled_at = NOW()
         WHERE id = ? AND status IN ('new','contacted')`,
        [req.user.id, id]
      );
      if (!c.affectedRows) return fail(res, 409, 'This request was already handled');
      claimed = true;

      const reason = `Online request ${row.reference || `#${id}`}${row.message ? `: ${row.message}` : ''}`.slice(0, 255);
      const appt = await appointments.create({
        patient_id: Number(req.body.patient_id),
        doctor_id: Number(req.body.doctor_id),
        type: 'scheduled',
        appointment_date: req.body.appointment_date,
        start_time: req.body.start_time,
        reason,
      }, req.user.id);
      created = true;

      await pool.query('UPDATE appointment_requests SET appointment_id = ? WHERE id = ?', [appt.id, id]);
      await logAudit({ userId: req.user.id, action: 'CREATE', module: 'appointments', recordId: appt.id, details: { from_request: id }, ip: req.ip });
      return ok(res, { appointment_id: appt.id }, 'Appointment created', 201);
    } catch (e) {
      if (claimed && !created) {
        await pool.query(
          'UPDATE appointment_requests SET status = ?, handled_at = NULL WHERE id = ?',
          [prevStatus, id]
        ).catch(() => {});
      }
      return next(e);
    }
  }
);

module.exports = router;
