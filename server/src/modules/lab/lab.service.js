const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const withTransaction = require('../../utils/transaction');

const PENDING = ['ordered', 'collected', 'processing', 'resulted'];
const STATUSES = [...PENDING, 'verified', 'rejected', 'cancelled'];
const NAME = "CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name)";

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const compactDate = () => todayStr().replace(/-/g, '');

const orNull = (v) => {
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
};
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

// DECIMAL columns arrive as strings from MySQL
const num = (v) => (v === null || v === undefined ? null : Number(v));

// Numeric tests: the flag is calculated from the reference range.
// Critical = below half of the lower limit or above double the upper limit (demo rule,
// the hospital laboratory should replace it with its own critical limits).
// Qualitative tests (no numeric range): the technician chooses the interpretation.
function computeResult(test, rawValue, clientFlag) {
  const lo = num(test.ref_low);
  const hi = num(test.ref_high);
  const text = String(rawValue).trim();

  if (lo === null && hi === null) {
    if (!['normal', 'high', 'critical'].includes(clientFlag)) {
      throw new HttpError(422, 'Select the interpretation (normal, abnormal or critical)');
    }
    return { value: text, flag: clientFlag };
  }

  const clean = text.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(clean)) throw new HttpError(422, 'This test needs a numeric result');
  const n = Number(clean);

  let flag = 'normal';
  if (lo !== null && n < lo) flag = 'low';
  if (hi !== null && n > hi) flag = 'high';
  if ((lo !== null && lo > 0 && n < lo * 0.5) || (hi !== null && hi > 0 && n > hi * 2)) flag = 'critical';
  return { value: clean, flag };
}

// Lock order is always: visit first, then lab order (same as the OPD module),
// so the two modules can never deadlock each other.
async function loadOrder(conn, id) {
  const [[pre]] = await conn.query('SELECT encounter_id FROM lab_orders WHERE id = ?', [id]);
  if (!pre) throw new HttpError(404, 'Lab order not found');
  await conn.query('SELECT id FROM encounters WHERE id = ? FOR UPDATE', [pre.encounter_id]);
  const [[order]] = await conn.query('SELECT * FROM lab_orders WHERE id = ? FOR UPDATE', [id]);
  return order;
}

// When the last pending test is finished, the doctor's visit returns to "in consultation"
async function syncEncounter(conn, encounterId) {
  const [[enc]] = await conn.query('SELECT status FROM encounters WHERE id = ?', [encounterId]);
  if (!enc || enc.status !== 'awaiting_results') return;
  const [[{ n }]] = await conn.query(
    'SELECT COUNT(*) AS n FROM lab_orders WHERE encounter_id = ? AND status IN (?)', [encounterId, PENDING]
  );
  if (n === 0) await conn.query("UPDATE encounters SET status = 'in_consultation' WHERE id = ?", [encounterId]);
}

// ---------- queue ----------
async function list(f, user) {
  const has = (...codes) => codes.some((c) => user.permissions.includes(c));
  const canSeeUnverified = has('lab.enter_result', 'lab.verify');
  const isDoctor = user.role === 'doctor';

  let status = f.status || 'active';
  if (status !== 'active' && status !== 'all' && !STATUSES.includes(status)) status = 'active';

  const where = [];
  const params = [];

  if (status === 'active') where.push("lo.status IN ('ordered','collected','processing','resulted')");
  else if (status !== 'all') { where.push('lo.status = ?'); params.push(status); }

  if (status !== 'active') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : todayStr();
    where.push(`DATE(${status === 'verified' ? 'lo.verified_at' : 'lo.created_at'}) = ?`);
    params.push(date);
  }

  const q = (f.search || '').trim();
  if (q) {
    where.push(`(p.mrn LIKE ? OR lo.barcode LIKE ? OR ${NAME} LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  // Resource-level rule: a doctor only sees the tests they ordered
  if (isDoctor) { where.push('lo.ordered_by = ?'); params.push(user.id); }

  const [rows] = await pool.query(
    `SELECT lo.id, lo.encounter_id, lo.patient_id, lo.status, lo.priority, lo.barcode, lo.created_at,
            lo.collected_at, lo.resulted_at, lo.verified_at, lo.result_value, lo.result_flag,
            lo.result_comment, lo.reject_reason, lo.resulted_by, lo.verified_by,
            t.code, t.name AS test_name, t.category, t.specimen, t.unit, t.ref_low, t.ref_high, t.ref_text,
            p.mrn, ${NAME} AS patient_name, p.gender, p.date_of_birth,
            ob.full_name AS ordered_by_name, rb.full_name AS resulted_by_name, vb.full_name AS verified_by_name
     FROM lab_orders lo
     JOIN lab_tests t ON t.id = lo.test_id
     JOIN patients p ON p.id = lo.patient_id
     LEFT JOIN users ob ON ob.id = lo.ordered_by
     LEFT JOIN users rb ON rb.id = lo.resulted_by
     LEFT JOIN users vb ON vb.id = lo.verified_by
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${status === 'verified' ? 'lo.verified_at DESC' : "(lo.priority = 'urgent') DESC, lo.created_at, lo.id"}
     LIMIT 300`,
    params
  );

  // Unverified results are only visible to the people who work on them
  const items = rows.map((r) => (
    canSeeUnverified || r.status === 'verified' ? r : { ...r, result_value: null, result_flag: null, result_comment: null }
  ));

  // summary cards
  const own = isDoctor ? ' AND ordered_by = ?' : '';
  const ownP = isDoctor ? [user.id] : [];
  const [counts] = await pool.query(
    `SELECT status, COUNT(*) AS n FROM lab_orders WHERE status IN (?)${own} GROUP BY status`, [PENDING, ...ownP]
  );
  const [[crit]] = await pool.query(
    `SELECT COUNT(*) AS n FROM lab_orders WHERE status = 'resulted' AND result_flag = 'critical'${own}`, ownP
  );
  const [[done]] = await pool.query(
    `SELECT COUNT(*) AS n, AVG(TIMESTAMPDIFF(MINUTE, created_at, verified_at)) AS tat
     FROM lab_orders WHERE status = 'verified' AND DATE(verified_at) = CURDATE()${own}`, ownP
  );
  const c = (s) => counts.find((x) => x.status === s)?.n || 0;

  return {
    items,
    summary: {
      ordered: c('ordered'),
      in_lab: c('collected') + c('processing'),
      resulted: c('resulted'),
      critical: canSeeUnverified ? crit.n : 0,
      verified_today: done.n,
      avg_tat: done.tat === null ? null : Math.round(Number(done.tat)),
    },
  };
}

// ---------- workflow ----------
async function collect(id, user) {
  return withTransaction(async (conn) => {
    const o = await loadOrder(conn, id);
    if (o.status !== 'ordered') throw new HttpError(400, 'Only tests in the "ordered" state can be collected');
    const barcode = `L${compactDate()}-${String(id).padStart(6, '0')}`;
    await conn.query(
      "UPDATE lab_orders SET status = 'collected', barcode = ?, collected_by = ?, collected_at = NOW() WHERE id = ?",
      [barcode, user.id, id]
    );
    return { barcode };
  });
}

async function startProcessing(id) {
  return withTransaction(async (conn) => {
    const o = await loadOrder(conn, id);
    if (o.status !== 'collected') throw new HttpError(400, 'The sample must be collected before processing starts');
    await conn.query("UPDATE lab_orders SET status = 'processing' WHERE id = ?", [id]);
  });
}

async function saveResult(id, body, user) {
  return withTransaction(async (conn) => {
    const o = await loadOrder(conn, id);
    if (!['collected', 'processing', 'resulted'].includes(o.status)) {
      throw new HttpError(400, 'Collect the sample first, or this test is already verified and cannot be changed');
    }
    const [[test]] = await conn.query('SELECT * FROM lab_tests WHERE id = ?', [o.test_id]);
    const { value, flag } = computeResult(test, body.result_value, body.result_flag);

    await conn.query(
      `UPDATE lab_orders SET status = 'resulted', result_value = ?, result_flag = ?, result_comment = ?,
              resulted_by = ?, resulted_at = NOW(), verified_by = NULL, verified_at = NULL WHERE id = ?`,
      [value, flag, orNull(body.result_comment), user.id, id]
    );
    return {
      test: test.name, value, flag,
      previous: o.status === 'resulted' ? { value: o.result_value, flag: o.result_flag } : null,
    };
  });
}

async function verify(id, user) {
  return withTransaction(async (conn) => {
    const o = await loadOrder(conn, id);
    if (o.status !== 'resulted') throw new HttpError(400, 'Only entered results can be verified');
    await conn.query(
      "UPDATE lab_orders SET status = 'verified', verified_by = ?, verified_at = NOW() WHERE id = ?", [user.id, id]
    );
    await syncEncounter(conn, o.encounter_id);
    return { flag: o.result_flag, critical: o.result_flag === 'critical', self: o.resulted_by === user.id };
  });
}

async function reject(id, reason, user) {
  return withTransaction(async (conn) => {
    const o = await loadOrder(conn, id);
    if (!['ordered', 'collected', 'processing'].includes(o.status)) {
      throw new HttpError(400, 'This test can no longer be rejected');
    }
    await conn.query(
      "UPDATE lab_orders SET status = 'rejected', reject_reason = ?, collected_by = COALESCE(collected_by, ?) WHERE id = ?",
      [reason.trim(), user.id, id]
    );
    await syncEncounter(conn, o.encounter_id);
  });
}

// ---------- test catalog ----------
async function listCatalog(user) {
  const manager = user.permissions.includes('lab.manage_catalog');
  const [rows] = await pool.query(
    `SELECT t.id, t.code, t.name, t.category, t.specimen, t.unit, t.ref_low, t.ref_high, t.ref_text,
            t.is_active, s.price
     FROM lab_tests t LEFT JOIN service_catalog s ON s.id = t.service_id
     ${manager ? '' : 'WHERE t.is_active = 1'}
     ORDER BY t.category, t.name`
  );
  return rows;
}

function assertRange(lo, hi) {
  if (lo !== null && hi !== null && lo > hi) throw new HttpError(422, 'Reference low cannot be higher than reference high');
}

async function createTest(d) {
  const lo = numOrNull(d.ref_low);
  const hi = numOrNull(d.ref_high);
  assertRange(lo, hi);
  return withTransaction(async (conn) => {
    const [s] = await conn.query(
      "INSERT INTO service_catalog (code, name, category, price) VALUES (?, ?, 'laboratory', ?)",
      [`LAB-${d.code}`, d.name.trim(), Number(d.price)]
    );
    const [r] = await conn.query(
      `INSERT INTO lab_tests (code, name, category, specimen, unit, ref_low, ref_high, ref_text, service_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [d.code, d.name.trim(), orNull(d.category), orNull(d.specimen), orNull(d.unit), lo, hi, orNull(d.ref_text), s.insertId]
    );
    return r.insertId;
  });
}

async function updateTest(id, d) {
  const lo = numOrNull(d.ref_low);
  const hi = numOrNull(d.ref_high);
  assertRange(lo, hi);
  return withTransaction(async (conn) => {
    const [[t]] = await conn.query('SELECT * FROM lab_tests WHERE id = ? FOR UPDATE', [id]);
    if (!t) throw new HttpError(404, 'Test not found');
    const active = d.is_active === undefined ? t.is_active : (d.is_active === true || d.is_active === 'true' ? 1 : 0);

    await conn.query(
      `UPDATE lab_tests SET name = ?, category = ?, specimen = ?, unit = ?, ref_low = ?, ref_high = ?,
              ref_text = ?, is_active = ? WHERE id = ?`,
      [d.name.trim(), orNull(d.category), orNull(d.specimen), orNull(d.unit), lo, hi, orNull(d.ref_text), active, id]
    );

    if (t.service_id) {
      await conn.query('UPDATE service_catalog SET name = ?, price = ?, is_active = ? WHERE id = ?',
        [d.name.trim(), Number(d.price), active, t.service_id]);
    } else {
      const [s] = await conn.query(
        "INSERT INTO service_catalog (code, name, category, price, is_active) VALUES (?, ?, 'laboratory', ?, ?)",
        [`LAB-${t.code}`, d.name.trim(), Number(d.price), active]
      );
      await conn.query('UPDATE lab_tests SET service_id = ? WHERE id = ?', [s.insertId, id]);
    }
    return { name: d.name.trim(), price: Number(d.price), active };
  });
}

module.exports = {
  list, collect, startProcessing, saveResult, verify, reject, listCatalog, createTest, updateTest,
};