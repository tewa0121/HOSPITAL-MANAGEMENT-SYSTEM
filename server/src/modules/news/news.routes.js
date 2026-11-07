const router = require('express').Router();
const { body } = require('express-validator');
const pool = require('../../config/db');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { logAudit } = require('../../middleware/audit');
const { ok, fail } = require('../../utils/response');

router.use(authenticate, requirePermission('news.manage'));
router.param('id', (req, res, next, val) => (/^\d+$/.test(val) ? next() : fail(res, 400, 'Invalid id')));

const rules = [
  body('kind').isIn(['news', 'event', 'announcement']).withMessage('Invalid type'),
  body('title_en').trim().isLength({ min: 3, max: 200 }).withMessage('English title is required'),
  body('title_am').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('body_en').trim().isLength({ min: 3, max: 5000 }).withMessage('English text is required'),
  body('body_am').optional({ checkFalsy: true }).trim().isLength({ max: 5000 }),
  body('event_date').optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid date'),
  body('is_published').optional().isBoolean(),
];

const values = (b) => [
  b.kind, b.title_en.trim(), (b.title_am || '').trim() || null, b.body_en.trim(), (b.body_am || '').trim() || null,
  b.event_date || null, b.is_published === false || b.is_published === 0 || b.is_published === '0' ? 0 : 1,
];

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM news_posts ORDER BY published_at DESC, id DESC LIMIT 200');
    ok(res, rows);
  } catch (e) { next(e); }
});

router.post('/', rules, validate, async (req, res, next) => {
  try {
    const [r] = await pool.query(
      `INSERT INTO news_posts (kind, title_en, title_am, body_en, body_am, event_date, is_published, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [...values(req.body), req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'CREATE', module: 'news', recordId: r.insertId, ip: req.ip });
    ok(res, { id: r.insertId }, 'Post created', 201);
  } catch (e) { next(e); }
});

router.put('/:id', rules, validate, async (req, res, next) => {
  try {
    const [r] = await pool.query(
      `UPDATE news_posts SET kind=?, title_en=?, title_am=?, body_en=?, body_am=?, event_date=?, is_published=?
       WHERE id = ?`,
      [...values(req.body), req.params.id]
    );
    if (!r.affectedRows) return fail(res, 404, 'Post not found');
    await logAudit({ userId: req.user.id, action: 'UPDATE', module: 'news', recordId: req.params.id, ip: req.ip });
    return ok(res, null, 'Post updated');
  } catch (e) { return next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM news_posts WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return fail(res, 404, 'Post not found');
    await logAudit({ userId: req.user.id, action: 'DELETE', module: 'news', recordId: req.params.id, ip: req.ip });
    return ok(res, null, 'Post deleted');
  } catch (e) { return next(e); }
});

module.exports = router;
