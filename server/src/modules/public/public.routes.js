const crypto = require('crypto');
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const pool = require('../../config/db');

// Public endpoints: no login, so they are strictly validated and limited per IP.
const limit = (max) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/* ---------- Appointment requests ---------- */

router.post('/appointment-requests', limit(5), async (req, res, next) => {
  try {
    const fullName = clean(req.body.fullName, 120);
    const phone = clean(req.body.phone, 20).replace(/[\s-]/g, '');
    const department = clean(req.body.department, 100);
    const preferredDate = clean(req.body.preferredDate, 10);
    const message = clean(req.body.message, 500) || null;

    const errors = [];
    if (fullName.length < 3) errors.push('Full name is required');
    if (!/^\+?\d{9,15}$/.test(phone)) errors.push('Phone number is not valid');
    if (!department) errors.push('Department is required');

    const date = new Date(`${preferredDate}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const max = new Date(today); max.setFullYear(max.getFullYear() + 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || Number.isNaN(date.getTime()) || date < today || date > max) {
      errors.push('Preferred date is not valid');
    }
    if (errors.length) return res.status(400).json({ message: errors.join('. ') });

    // 8-character reference the patient keeps to track the request
    let reference;
    for (let i = 0; i < 5; i += 1) {
      reference = crypto.randomBytes(4).toString('hex').toUpperCase();
      try {
        // eslint-disable-next-line no-await-in-loop
        await pool.query(
          `INSERT INTO appointment_requests (reference, full_name, phone, department, preferred_date, message)
           VALUES (?,?,?,?,?,?)`,
          [reference, fullName, phone, department, preferredDate, message]
        );
        return res.status(201).json({ message: 'Request received', reference });
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err; // reference clash: try another one
      }
    }
    return res.status(500).json({ message: 'Could not save the request' });
  } catch (err) { return next(err); }
});

// Patient checks the progress of a request with the reference + the phone number used.
router.get('/appointment-requests/status', limit(20), async (req, res, next) => {
  try {
    const reference = clean(req.query.reference, 8).toUpperCase();
    const digits = clean(req.query.phone, 20).replace(/\D/g, '');
    if (!/^[0-9A-F]{8}$/.test(reference) || digits.length < 9) {
      return res.status(400).json({ message: 'Enter the reference and the phone number you used' });
    }
    const [[row]] = await pool.query(
      `SELECT r.status, r.department, r.preferred_date, r.created_at,
              a.appointment_date, a.start_time, a.status AS appointment_status, d.full_name AS doctor_name
       FROM appointment_requests r
       LEFT JOIN appointments a ON a.id = r.appointment_id
       LEFT JOIN users d ON d.id = a.doctor_id
       WHERE r.reference = ? AND RIGHT(r.phone, 9) = ?`,
      [reference, digits.slice(-9)]
    );
    // same answer for "wrong reference" and "wrong phone": no guessing
    if (!row) return res.status(404).json({ message: 'No request found with these details' });
    return res.json({ data: row });
  } catch (err) { return next(err); }
});

/* ---------- News ---------- */

router.get('/news', limit(120), async (req, res, next) => {
  try {
    const n = Math.min(Number(req.query.limit) || 20, 50);
    const [items] = await pool.query(
      `SELECT id, kind, title_en, title_am, LEFT(body_en, 220) AS excerpt_en, LEFT(body_am, 220) AS excerpt_am,
              event_date, published_at
       FROM news_posts WHERE is_published = 1 ORDER BY published_at DESC, id DESC LIMIT ?`,
      [n]
    );
    res.json({ data: items });
  } catch (err) { next(err); }
});

router.get('/news/:id', limit(120), async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ message: 'Not found' });
    const [[post]] = await pool.query(
      `SELECT id, kind, title_en, title_am, body_en, body_am, event_date, published_at
       FROM news_posts WHERE id = ? AND is_published = 1`,
      [req.params.id]
    );
    if (!post) return res.status(404).json({ message: 'Not found' });
    return res.json({ data: post });
  } catch (err) { return next(err); }
});

module.exports = router;
