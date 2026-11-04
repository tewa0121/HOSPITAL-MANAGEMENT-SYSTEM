const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const controller = require('./auth.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

router.post(
  '/login',
  loginLimiter,
  [body('username').trim().notEmpty().withMessage('Username is required'),
   body('password').notEmpty().withMessage('Password is required')],
  validate,
  controller.login
);

router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);

router.post(
  '/change-password',
  authenticate,
  [body('currentPassword').notEmpty().withMessage('Current password is required'),
   body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
     .matches(/[A-Z]/).withMessage('Include at least one uppercase letter')
     .matches(/[0-9]/).withMessage('Include at least one number')],
  validate,
  controller.changePassword
);

module.exports = router;