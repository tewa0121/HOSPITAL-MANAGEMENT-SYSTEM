const mysql = require('mysql2/promise');
const { db } = require('./env');

const isLocal = ['127.0.0.1', 'localhost'].includes(String(db.host));

const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true, // dates come back as plain strings, no timezone surprises

  // needed for an online database such as Aiven
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

// Use the same SQL mode as MAMP (Aiven defaults to a strict ANSI mode)
pool.on('connection', (conn) => {
  conn.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");
});

module.exports = pool;