async function buildMrn(conn, id) {
  const [[row]] = await conn.query(
    "SELECT setting_value FROM settings WHERE setting_key = 'mrn_prefix'"
  );
  const prefix = row ? row.setting_value : 'HMS';
  return `${prefix}-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`;
}

module.exports = { buildMrn };