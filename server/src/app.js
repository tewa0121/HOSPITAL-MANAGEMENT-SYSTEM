const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { clientUrl } = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const { requirePermission } = require('./middleware/rbac');
const { ok } = require('./utils/response');

const app = express();

app.use(helmet());

// CORS configuration to accept requests from your Vercel frontend and configured clientUrl
app.use(cors({ 
  origin: [clientUrl, 'https://hospital-igh.vercel.app'].filter(Boolean), 
  credentials: true 
}));
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.get('/api/health', (req, res) => ok(res, { status: 'running', time: new Date() }));

// Registered API Routes (Duplicates removed)
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/patients', require('./modules/patients/patients.routes'));
app.use('/api/appointments', require('./modules/appointments/appointments.routes'));
app.use('/api/encounters', require('./modules/encounters/encounters.routes'));
app.use('/api/lab', require('./modules/lab/lab.routes'));
app.use('/api/pharmacy', require('./modules/pharmacy/pharmacy.routes'));
app.use('/api/billing', require('./modules/billing/billing.routes'));
app.use('/api/wards', require('./modules/wards/wards.routes'));
app.use('/api/reports', require('./modules/reports/reports.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/roles', require('./modules/roles/roles.routes'));
app.use('/api/audit', require('./modules/audit/audit.routes'));
app.use('/api/settings', require('./modules/settings/settings.routes'));
app.use('/api/public', require('./modules/public/public.routes'));
app.use('/api/requests', require('./modules/requests/requests.routes'));
app.use('/api/news', require('./modules/news/news.routes'));
// TEMPORARY: proves RBAC works. Delete this route later.
app.get('/api/rbac-test', authenticate, requirePermission('patients.create'),
  (req, res) => ok(res, null, `Access granted for ${req.user.role}`));

app.use(notFound);
app.use(errorHandler);

module.exports = app;