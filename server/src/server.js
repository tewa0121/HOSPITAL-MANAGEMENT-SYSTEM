const app = require('./app');
const pool = require('./config/db');
const { port, jwt } = require('./config/env');

(async () => {
  if (!jwt.secret) {
    console.error('❌ JWT_SECRET is missing in server/.env');
    process.exit(1);
  }
  try {
    await pool.query('SELECT 1');
    console.log('✔ MySQL connected');
  } catch (e) {
    console.error('❌ MySQL connection failed:', e.message);
    process.exit(1);
  }
  app.listen(port, () => console.log(`✔ HMS API running on http://localhost:${port}`));
})();