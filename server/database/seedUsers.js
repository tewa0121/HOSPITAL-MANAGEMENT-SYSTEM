require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const PASSWORD = 'Hms@2026'; // demo password for every account, change after first login

const users = [
  { full_name: 'System Administrator', username: 'superadmin', role: 'super_admin',    dept: 'Administration' },
  { full_name: 'Selam Tadesse',        username: 'admin',      role: 'hospital_admin', dept: 'Administration' },
  { full_name: 'Dr. Abebe Kebede',     username: 'doctor1',    role: 'doctor',         dept: 'General OPD' },
  { full_name: 'Dr. Marta Wolde',      username: 'doctor2',    role: 'doctor',         dept: 'Internal Medicine' },
  { full_name: 'Tigist Alemu',         username: 'nurse1',     role: 'nurse',          dept: 'General OPD' },
  { full_name: 'Hana Tesfaye',         username: 'reception1', role: 'receptionist',   dept: 'Reception' },
  { full_name: 'Dawit Bekele',         username: 'lab1',       role: 'lab_technician', dept: 'Laboratory' },
  { full_name: 'Meron Girma',          username: 'pharma1',    role: 'pharmacist',     dept: 'Pharmacy' },
  { full_name: 'Samuel Haile',         username: 'cashier1',   role: 'cashier',        dept: 'Finance' },
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const hash = await bcrypt.hash(PASSWORD, 10);

  for (const u of users) {
    const [[role]] = await conn.query('SELECT id FROM roles WHERE name = ?', [u.role]);
    const [[dept]] = await conn.query('SELECT id FROM departments WHERE name = ?', [u.dept]);
    await conn.query(
      `INSERT INTO users (full_name, username, email, password_hash, role_id, department_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [u.full_name, u.username, `${u.username}@hms.local`, hash, role.id, dept.id]
    );
    console.log(`✔ ${u.username.padEnd(11)} (${u.role})`);
  }

  console.log(`\nDone. Password for all demo users: ${PASSWORD}`);
  await conn.end();
})().catch((e) => { console.error('❌', e.message); process.exit(1); });