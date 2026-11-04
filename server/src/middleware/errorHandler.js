const { fail } = require('../utils/response');

exports.notFound = (req, res) => fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);

exports.errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') return fail(res, 409, 'A record with this value already exists');
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return fail(res, 400, 'Related record does not exist');
  return fail(res, err.status || 500, err.status ? err.message : 'Internal server error');
};