// Checks that every table exists and runs a few dashboard-style queries.
// Run from the server folder:  node database\checkDb.js
require('dotenv').config();
const pool = require('../src/config/db');

const TABLES = ['roles','permissions','role_permissions','user_permissions','departments','users','settings','patients',
  'appointments','appointment_requests','news_posts','encounters','vital_signs','diagnoses','lab_tests','lab_orders',
  'medications','medication_batches','prescriptions','prescription_items','dispensing','service_catalog','invoices',
  'invoice_items','payments','wards','beds','admissions','bed_assignments','audit_logs'];

const QUERIES = {
  'encounters by day': "SELECT DATE(started_at) d, COUNT(*) n FROM encounters WHERE status <> 'cancelled' GROUP BY d",
  'payments by day': 'SELECT DATE(paid_at) d, SUM(amount) n FROM payments GROUP BY d',
  'payments by method today': 'SELECT method, SUM(amount) n FROM payments WHERE DATE(paid_at) = CURDATE() GROUP BY method',
  'patients count': 'SELECT COUNT(*) n FROM patients',
  'encounter 114': 'SELECT * FROM encounters WHERE id = 114',
  'encounter 118': 'SELECT * FROM encounters WHERE id = 118',
};

(async () => {
  try {
    const [[v]] = await pool.query('SELECT VERSION() v, @@sql_mode m');
    console.log('MySQL', v.v, '\nsql_mode:', v.m, '\n');
    for (const t of TABLES) {
      try { const [[r]] = await pool.query(`SELECT COUNT(*) n FROM \`${t}\``); console.log('OK  ', t.padEnd(22), r.n); }
      catch (e) { console.log('FAIL', t.padEnd(22), e.code, e.sqlMessage || e.message); }
    }
    console.log('');
    for (const [name, sql] of Object.entries(QUERIES)) {
      try { const [r] = await pool.query(sql); console.log('OK  ', name, `(${r.length} rows)`); }
      catch (e) { console.log('FAIL', name, '->', e.code, e.sqlMessage || e.message); }
    }
  } catch (e) { console.log('Connection problem:', e.code, e.message); }
  process.exit();
})();