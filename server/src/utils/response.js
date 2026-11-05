exports.ok = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });

exports.fail = (res, status = 400, message = 'Request failed', errors = null) =>
  res.status(status).json({ success: false, message, errors });