const { fail } = require('../utils/response');

// User must have ALL listed permissions
const requirePermission = (...codes) => (req, res, next) => {
  const have = req.user?.permissions || [];
  const ok = codes.every((c) => have.includes(c));
  if (!ok) return fail(res, 403, 'You do not have permission to perform this action');
  next();
};

// User must have AT LEAST ONE of the listed permissions
const requireAny = (...codes) => (req, res, next) => {
  const have = req.user?.permissions || [];
  if (!codes.some((c) => have.includes(c)))
    return fail(res, 403, 'You do not have permission to perform this action');
  next();
};

module.exports = { requirePermission, requireAny };