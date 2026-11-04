const pool = require('../config/db');

async function logAudit({ userId = null, action, module, recordId = null, details = null, ip = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, module, recordId ? String(recordId) : null,
       details ? JSON.stringify(details) : null, ip]
    );
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

module.exports = { logAudit };