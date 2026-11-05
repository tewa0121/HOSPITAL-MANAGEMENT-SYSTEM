const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const withTransaction = require('../../utils/transaction');
const { withBedDays } = require('../../utils/bedDays');

const NAME = "CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name)";
const MINUTES = (from, to) => `TIMESTAMPDIFF(MINUTE, ${from}, COALESCE(${to}, NOW()))`;

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const orNull = (v) => {
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
};
const flag = (v, fallback) => (v === undefined ? fallback : v === true || v === 'true' ? 1 : 0);
const money = (days, rate) => Math.round(days * Number(rate) * 100) / 100;
const dayCount = (minutes) => Math.max(1, Math.ceil(Number(minutes) / 1440));

function ageYears(dob) {
  const [y, m, d] = String(dob).slice(0, 10).split('-').map(Number);
  const n = new Date();
  let a = n.getFullYear() - y;
  if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--;
  return a;
}

// Ward admission rules, based on the ward codes from the seed data
function wardRule(wardCode, patient) {
  const age = ageYears(patient.date_of_birth);
  if (wardCode === 'GM' && !(patient.gender === 'male' && age >= 15)) return 'The male general ward is for male patients aged 15 and over';
  if (wardCode === 'GF' && !(patient.gender === 'female' && age >= 15)) return 'The female general ward is for female patients aged 15 and over';
  if (wardCode === 'MAT' && patient.gender !== 'female') return 'The maternity ward is for female patients';
  if (wardCode === 'PED' && age >= 15) return 'The pediatric ward is for patients under 15';
  return null;
}

// ======================= BED BOARD =======================

async function board(user) {
  const manage = user.permissions.includes('wards.manage');
  const [wards] = await pool.query(
    `SELECT id, code, name, name_am, capacity, daily_rate, is_active FROM wards
     ${manage ? '' : 'WHERE is_active = 1'} ORDER BY id`
  );
  const [beds] = await pool.query(
    `SELECT b.id, b.ward_id, b.bed_number, b.status,
            a.id AS admission_id, a.admitted_at, a.patient_id,
            p.mrn, ${NAME} AS patient_name, p.gender, p.date_of_birth, u.full_name AS doctor_name
     FROM beds b
     LEFT JOIN admissions a ON a.bed_id = b.id AND a.status = 'admitted'
     LEFT JOIN patients p ON p.id = a.patient_id
     LEFT JOIN users u ON u.id = a.admitting_doctor_id
     ORDER BY b.ward_id, b.bed_number`
  );

  const total = { beds: 0, occupied: 0, available: 0, cleaning: 0, maintenance: 0, reserved: 0 };
  const result = wards.map((w) => {
    const list = beds.filter((b) => b.ward_id === w.id);
    const counts = { available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
    list.forEach((b) => { counts[b.status]++; });
    if (w.is_active) {
      total.beds += list.length;
      Object.keys(counts).forEach((k) => { total[k] += counts[k]; });
    }
    return { ...w, is_active: !!w.is_active, daily_rate: Number(w.daily_rate), beds: list, counts };
  });

  // occupancy = occupied beds / beds that are not under maintenance
  const staffed = total.beds - total.maintenance;
  return {
    wards: result,
    summary: { ...total, occupancy: staffed > 0 ? Math.round((total.occupied / staffed) * 100) : 0 },
  };
}

async function availableBeds(patientId) {
  let patient = null;
  if (patientId) {
    [[patient]] = await pool.query('SELECT gender, date_of_birth FROM patients WHERE id = ?', [patientId]);
    if (!patient) throw new HttpError(404, 'Patient not found');
  }
  const [rows] = await pool.query(
    `SELECT b.id, b.bed_number, w.id AS ward_id, w.code AS ward_code, w.name AS ward_name,
            w.name_am AS ward_name_am, w.daily_rate
     FROM beds b JOIN wards w ON w.id = b.ward_id
     WHERE b.status = 'available' AND w.is_active = 1
     ORDER BY w.id, b.bed_number`
  );
  return rows.map((r) => {
    const reason = patient ? wardRule(r.ward_code, patient) : null;
    return { ...r, daily_rate: Number(r.daily_rate), eligible: !reason, reason };
  });
}

// ======================= WARD MANAGEMENT =======================

async function insertBeds(conn, wardId, code, start, count) {
  for (let i = 1; i <= count; i++) {
    await conn.query('INSERT INTO beds (ward_id, bed_number) VALUES (?, ?)', [wardId, `${code}-${pad(start + i)}`]);
  }
}

async function createWard(d) {
  return withTransaction(async (conn) => {
    const [dup] = await conn.query('SELECT id FROM wards WHERE code = ?', [d.code]);
    if (dup.length) throw new HttpError(409, 'A ward with this code already exists');
    const n = Number(d.beds || 0);
    const [r] = await conn.query(
      'INSERT INTO wards (code, name, name_am, capacity, daily_rate) VALUES (?,?,?,?,?)',
      [d.code, d.name.trim(), orNull(d.name_am), n, Number(d.daily_rate)]
    );
    if (n) await insertBeds(conn, r.insertId, d.code, 0, n);
    return r.insertId;
  });
}

async function updateWard(id, d) {
  return withTransaction(async (conn) => {
    const [[w]] = await conn.query('SELECT * FROM wards WHERE id = ? FOR UPDATE', [id]);
    if (!w) throw new HttpError(404, 'Ward not found');
    const active = flag(d.is_active, w.is_active);
    if (w.is_active && !active) {
      const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM beds WHERE ward_id = ? AND status = 'occupied'", [id]);
      if (n) throw new HttpError(409, 'This ward has occupied beds. Transfer or discharge the patients first.');
    }
    await conn.query(
      'UPDATE wards SET name = ?, name_am = ?, daily_rate = ?, is_active = ? WHERE id = ?',
      [d.name.trim(), orNull(d.name_am), Number(d.daily_rate), active, id]
    );
    return { code: w.code, old_rate: Number(w.daily_rate), new_rate: Number(d.daily_rate), active: !!active };
  });
}

async function addBeds(wardId, count) {
  return withTransaction(async (conn) => {
    const [[w]] = await conn.query('SELECT * FROM wards WHERE id = ? FOR UPDATE', [wardId]);
    if (!w) throw new HttpError(404, 'Ward not found');
    if (!w.is_active) throw new HttpError(400, 'This ward is inactive');
    const [rows] = await conn.query('SELECT bed_number FROM beds WHERE ward_id = ?', [wardId]);
    if (rows.length + count > 100) throw new HttpError(400, 'A ward can have at most 100 beds');
    const maxNo = rows.reduce((m, r) => Math.max(m, Number((r.bed_number.match(/(\d+)$/) || [0, 0])[1])), 0);
    await insertBeds(conn, wardId, w.code, maxNo, count);
    await conn.query('UPDATE wards SET capacity = ? WHERE id = ?', [rows.length + count, wardId]);
    return { ward: w.name, added: count, total: rows.length + count };
  });
}

// Occupied beds can only be freed by transferring or discharging the patient
async function setBedStatus(bedId, status) {
  return withTransaction(async (conn) => {
    const [[bed]] = await conn.query('SELECT * FROM beds WHERE id = ? FOR UPDATE', [bedId]);
    if (!bed) throw new HttpError(404, 'Bed not found');
    if (bed.status === 'occupied') throw new HttpError(409, 'An occupied bed cannot be changed. Transfer or discharge the patient first.');
    if (bed.status === status) throw new HttpError(400, `The bed is already ${status}`);
    await conn.query('UPDATE beds SET status = ? WHERE id = ?', [status, bedId]);
    return { bed_number: bed.bed_number, before: bed.status, after: status };
  });
}

// ======================= ADMISSIONS =======================

async function listAdmissions(f, user) {
  const clinical = user.permissions.includes('encounters.read');
  const status = ['admitted', 'discharged', 'all'].includes(f.status) ? f.status : 'admitted';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : todayStr();
  const q = (f.search || '').trim();

  const where = [];
  const params = [];
  if (status === 'admitted') where.push("a.status = 'admitted'");
  else if (status === 'discharged') {
    where.push("a.status = 'discharged'");
    if (!q) { where.push('DATE(a.discharged_at) = ?'); params.push(date); }
  } else if (!q) {
    where.push('(DATE(a.admitted_at) = ? OR DATE(a.discharged_at) = ?)');
    params.push(date, date);
  }
  if (q) { where.push(`(p.mrn LIKE ? OR ${NAME} LIKE ?)`); params.push(`%${q}%`, `%${q}%`); }

  const [rows] = await pool.query(
    `SELECT a.id, a.status, a.admitted_at, a.discharged_at, a.patient_id, a.reason,
            p.mrn, ${NAME} AS patient_name, p.gender, p.date_of_birth,
            b.bed_number, w.code AS ward_code, w.name AS ward_name, w.name_am AS ward_name_am,
            u.full_name AS doctor_name, ${MINUTES('a.admitted_at', 'a.discharged_at')} AS minutes
     FROM admissions a
     JOIN patients p ON p.id = a.patient_id
     JOIN beds b ON b.id = a.bed_id
     JOIN wards w ON w.id = b.ward_id
     JOIN users u ON u.id = a.admitting_doctor_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.admitted_at DESC, a.id DESC LIMIT 300`,
    params
  );

  const [[s]] = await pool.query(
    `SELECT SUM(status = 'admitted') AS now_in, SUM(DATE(admitted_at) = CURDATE()) AS today_in,
            SUM(status = 'discharged' AND DATE(discharged_at) = CURDATE()) AS today_out FROM admissions`
  );
  const [[l]] = await pool.query(
    `SELECT AVG(TIMESTAMPDIFF(MINUTE, admitted_at, discharged_at)) AS m FROM admissions
     WHERE status = 'discharged' AND discharged_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
  );

  return {
    items: rows.map((r) => ({ ...r, days: dayCount(r.minutes), reason: clinical ? r.reason : null })),
    summary: {
      now_in: Number(s.now_in || 0), today_in: Number(s.today_in || 0), today_out: Number(s.today_out || 0),
      avg_los: l.m === null ? null : Math.round((Number(l.m) / 1440) * 10) / 10,
    },
  };
}

async function admissionDetail(id, user) {
  const has = (...codes) => codes.some((c) => user.permissions.includes(c));
  const clinical = has('encounters.read');

  const [[a]] = await pool.query(
    `SELECT a.*, p.mrn, p.gender, p.date_of_birth, p.blood_group, p.phone AS patient_phone,
            ${NAME} AS patient_name, b.bed_number, w.code AS ward_code, w.name AS ward_name, w.name_am AS ward_name_am,
            u.full_name AS doctor_name, dby.full_name AS discharged_by_name,
            ${MINUTES('a.admitted_at', 'a.discharged_at')} AS minutes
     FROM admissions a
     JOIN patients p ON p.id = a.patient_id
     JOIN beds b ON b.id = a.bed_id
     JOIN wards w ON w.id = b.ward_id
     JOIN users u ON u.id = a.admitting_doctor_id
     LEFT JOIN users dby ON dby.id = a.discharged_by
     WHERE a.id = ?`, [id]
  );
  if (!a) throw new HttpError(404, 'Admission not found');

  const [assignments] = await pool.query(
    `SELECT ba.id, ba.assigned_at, ba.released_at, ba.transfer_reason, b.bed_number,
            w.name AS ward_name, w.name_am AS ward_name_am, w.daily_rate, u.full_name AS assigned_by_name,
            ${MINUTES('ba.assigned_at', 'ba.released_at')} AS minutes
     FROM bed_assignments ba
     JOIN beds b ON b.id = ba.bed_id
     JOIN wards w ON w.id = b.ward_id
     LEFT JOIN users u ON u.id = ba.assigned_by
     WHERE ba.admission_id = ? ORDER BY ba.id`, [id]
  );
  const history = withBedDays(assignments).map((r) => ({
    ...r, daily_rate: Number(r.daily_rate), charge: money(r.days, r.daily_rate),
  }));

  const result = {
    id: a.id, status: a.status, patient_id: a.patient_id, encounter_id: a.encounter_id,
    mrn: a.mrn, patient_name: a.patient_name, gender: a.gender, date_of_birth: a.date_of_birth,
    blood_group: a.blood_group, patient_phone: a.patient_phone,
    bed_number: a.bed_number, ward_code: a.ward_code, ward_name: a.ward_name, ward_name_am: a.ward_name_am,
    doctor_name: a.doctor_name, admitted_at: a.admitted_at, discharged_at: a.discharged_at,
    discharged_by_name: a.discharged_by_name, days: dayCount(a.minutes),
    bed_history: history,
    bed_total: Math.round(history.reduce((s, h) => s + h.charge * 100, 0)) / 100,
  };

  // Clinical content is only sent to users with clinical access (not to the hospital administrator)
  if (clinical) {
    result.reason = a.reason;
    result.discharge_summary = a.discharge_summary;
    [result.allergies] = await pool.query(
      `SELECT id, allergen, reaction, severity FROM allergies WHERE patient_id = ?
       ORDER BY FIELD(severity, 'severe','moderate','mild')`, [a.patient_id]
    );
    [result.notes] = await pool.query(
      `SELECT n.id, n.note_type, n.note, n.created_at, u.full_name AS author_name
       FROM admission_notes n JOIN users u ON u.id = n.author_id
       WHERE n.admission_id = ? ORDER BY n.id DESC`, [id]
    );
  }

  if (has('billing.invoice_read')) {
    const [[inv]] = await pool.query(
      "SELECT id, invoice_no, status, total, amount_paid FROM invoices WHERE admission_id = ? AND status <> 'cancelled' ORDER BY id DESC LIMIT 1", [id]
    );
    result.invoice = inv
      ? { id: inv.id, invoice_no: inv.invoice_no, status: inv.status, balance: Math.round((Number(inv.total) - Number(inv.amount_paid)) * 100) / 100 }
      : null;
  }
  return result;
}

async function admit(d, user) {
  return withTransaction(async (conn) => {
    // lock order: visit -> patient -> bed
    if (d.encounter_id) {
      const [[e]] = await conn.query('SELECT * FROM encounters WHERE id = ? FOR UPDATE', [d.encounter_id]);
      if (!e) throw new HttpError(404, 'Visit not found');
      if (e.patient_id !== Number(d.patient_id)) throw new HttpError(400, 'This visit belongs to another patient');
      if (e.status === 'cancelled') throw new HttpError(400, 'A cancelled visit cannot lead to an admission');
      if (user.role === 'doctor' && e.doctor_id !== user.id) throw new HttpError(403, 'This visit belongs to another doctor');
    }

    const [[patient]] = await conn.query('SELECT id, status, gender, date_of_birth FROM patients WHERE id = ? FOR UPDATE', [d.patient_id]);
    if (!patient) throw new HttpError(404, 'Patient not found');
    if (patient.status !== 'active') throw new HttpError(400, 'This patient record is not active');
    const [current] = await conn.query("SELECT id FROM admissions WHERE patient_id = ? AND status = 'admitted' LIMIT 1", [patient.id]);
    if (current.length) throw new HttpError(409, 'This patient is already admitted');

    const [[bed]] = await conn.query('SELECT * FROM beds WHERE id = ? FOR UPDATE', [d.bed_id]);
    if (!bed) throw new HttpError(404, 'Bed not found');
    if (bed.status !== 'available') throw new HttpError(409, `Bed ${bed.bed_number} is not available (${bed.status}). Choose another bed.`);
    const [[ward]] = await conn.query('SELECT code, name, is_active FROM wards WHERE id = ?', [bed.ward_id]);
    if (!ward.is_active) throw new HttpError(400, 'This ward is inactive');
    const rule = wardRule(ward.code, patient);
    if (rule) throw new HttpError(422, rule);

    const [r] = await conn.query(
      `INSERT INTO admissions (patient_id, encounter_id, bed_id, admitting_doctor_id, reason)
       VALUES (?,?,?,?,?)`,
      [patient.id, d.encounter_id || null, bed.id, user.id, d.reason.trim()]
    );
    await conn.query('INSERT INTO bed_assignments (admission_id, bed_id, assigned_by) VALUES (?,?,?)', [r.insertId, bed.id, user.id]);
    await conn.query("UPDATE beds SET status = 'occupied' WHERE id = ?", [bed.id]);
    return { id: r.insertId, bed: bed.bed_number, ward: ward.name };
  });
}

async function transfer(id, d, user) {
  return withTransaction(async (conn) => {
    const [[a]] = await conn.query('SELECT * FROM admissions WHERE id = ? FOR UPDATE', [id]);
    if (!a) throw new HttpError(404, 'Admission not found');
    if (a.status !== 'admitted') throw new HttpError(400, 'Only admitted patients can be transferred');
    const newId = Number(d.bed_id);
    if (newId === a.bed_id) throw new HttpError(400, 'The patient is already in this bed');

    // lock both beds in id order so two transfers can never deadlock each other
    await conn.query('SELECT id FROM beds WHERE id IN (?, ?) ORDER BY id FOR UPDATE', [a.bed_id, newId]);
    const [[bed]] = await conn.query('SELECT * FROM beds WHERE id = ?', [newId]);
    if (!bed) throw new HttpError(404, 'Bed not found');
    if (bed.status !== 'available') throw new HttpError(409, `Bed ${bed.bed_number} is not available (${bed.status}). Choose another bed.`);
    const [[ward]] = await conn.query('SELECT code, name, is_active FROM wards WHERE id = ?', [bed.ward_id]);
    if (!ward.is_active) throw new HttpError(400, 'This ward is inactive');
    const [[patient]] = await conn.query('SELECT gender, date_of_birth FROM patients WHERE id = ?', [a.patient_id]);
    const rule = wardRule(ward.code, patient);
    if (rule) throw new HttpError(422, rule);

    const [[old]] = await conn.query('SELECT bed_number FROM beds WHERE id = ?', [a.bed_id]);
    await conn.query('UPDATE bed_assignments SET released_at = NOW() WHERE admission_id = ? AND released_at IS NULL', [id]);
    await conn.query("UPDATE beds SET status = 'cleaning' WHERE id = ?", [a.bed_id]);
    await conn.query("UPDATE beds SET status = 'occupied' WHERE id = ?", [newId]);
    await conn.query('UPDATE admissions SET bed_id = ? WHERE id = ?', [newId, id]);
    await conn.query(
      'INSERT INTO bed_assignments (admission_id, bed_id, assigned_by, transfer_reason) VALUES (?,?,?,?)',
      [id, newId, user.id, d.reason.trim()]
    );
    return { from: old.bed_number, to: bed.bed_number, ward: ward.name, reason: d.reason.trim() };
  });
}

// Discharge never waits for payment. Billing is handled separately by the cashier.
async function discharge(id, d, user) {
  return withTransaction(async (conn) => {
    const [[a]] = await conn.query('SELECT * FROM admissions WHERE id = ? FOR UPDATE', [id]);
    if (!a) throw new HttpError(404, 'Admission not found');
    if (a.status !== 'admitted') throw new HttpError(400, 'This patient is already discharged');
    await conn.query('SELECT id FROM beds WHERE id = ? FOR UPDATE', [a.bed_id]);
    await conn.query('UPDATE bed_assignments SET released_at = NOW() WHERE admission_id = ? AND released_at IS NULL', [id]);
    await conn.query("UPDATE beds SET status = 'cleaning' WHERE id = ?", [a.bed_id]);
    await conn.query(
      "UPDATE admissions SET status = 'discharged', discharged_at = NOW(), discharged_by = ?, discharge_summary = ? WHERE id = ?",
      [user.id, d.summary.trim(), id]
    );
    const [[bed]] = await conn.query('SELECT bed_number FROM beds WHERE id = ?', [a.bed_id]);
    return { bed: bed.bed_number, patient_id: a.patient_id };
  });
}

async function addNote(id, d, user) {
  return withTransaction(async (conn) => {
    const [[a]] = await conn.query('SELECT id, status FROM admissions WHERE id = ? FOR UPDATE', [id]);
    if (!a) throw new HttpError(404, 'Admission not found');
    if (a.status !== 'admitted') throw new HttpError(400, 'Notes can only be added while the patient is admitted');
    const type = user.permissions.includes('encounters.update') ? 'progress' : 'nursing';
    const [r] = await conn.query(
      'INSERT INTO admission_notes (admission_id, author_id, note_type, note) VALUES (?,?,?,?)',
      [id, user.id, type, d.note.trim()]
    );
    return { id: r.insertId, type };
  });
}

module.exports = {
  board, availableBeds, createWard, updateWard, addBeds, setBedStatus,
  listAdmissions, admissionDetail, admit, transfer, discharge, addNote,
};