const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return fail(res, 422, 'Validation failed', errors);
};