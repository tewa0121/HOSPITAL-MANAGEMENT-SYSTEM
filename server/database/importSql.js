// Imports an .sql file into the database in server/.env (works with Aiven / SSL).
// Run from the server folder:
//   node database\importSql.js database\hms_full_database.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node database\\importSql.js <file.sql>'); process.exit(1); }
  const sql = fs.readFileSync(path.resolve(file), 'utf8');

  const useSsl = !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    connectTimeout: 20000,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  console.log('Connected to', process.env.DB_HOST);

  const db = process.env.DB_NAME || 'hms_db';
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
  await conn.query(`USE \`${db}\``);
  console.log('Importing into', db, '...');
  await conn.query(sql);
  const [rows] = await conn.query('SHOW TABLES');
  console.log(`Done. ${rows.length} tables in ${db}.`);
  await conn.end();
})().catch((e) => { console.error('Import failed:', e.code || '', e.message); process.exit(1); });