const service = require('./audit.service');
const { ok } = require('../../utils/response');

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

exports.list = wrap(async (req, res) => ok(res, await service.list(req.query, req.user)));
exports.filters = wrap(async (req, res) => ok(res, await service.filters()));
exports.logins = wrap(async (req, res) => ok(res, await service.logins(req.query)));