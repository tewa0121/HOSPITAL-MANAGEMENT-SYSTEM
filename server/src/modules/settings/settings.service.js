const pool = require('../../config/db');
const withTransaction = require('../../utils/transaction');

const EDITABLE = ['hospital_name', 'hospital_name_am', 'default_language', 'mrn_prefix', 'appointment_slot_minutes'];

async function all() {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
}

// shown on the login page and receipts, so it needs no login
async function publicInfo() {
  const s = await all();
  return {
    hospital_name: s.hospital_name || '',
    hospital_name_am: s.hospital_name_am || '',
    default_language: s.default_language || 'en',
  };
}

async function update(d) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT setting_key, setting_value FROM settings FOR UPDATE');
    const cur = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
    const changes = {};
    for (const key of EDITABLE) {
      const next = String(d[key] ?? '').trim();
      if (next === (cur[key] ?? '')) continue;
      await conn.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, next]
      );
      changes[key] = { from: cur[key] ?? null, to: next };
    }
    return changes;
  });
}

module.exports = { all, publicInfo, update };