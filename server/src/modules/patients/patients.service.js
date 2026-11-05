const crypto = require('crypto');
const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const { buildMrn } = require('../../utils/mrn');

const FIELDS = [
  'first_name', 'father_name', 'grandfather_name', 'gender', 'date_of_birth', 'phone',
  'region', 'zone', 'woreda', 'kebele', 'house_number', 'national_id',
  'blood_group', 'marital_status', 'occupation',
];
const NAME_EXPR = "CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name)";

const orNull = (v) => {
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
};

// 0911223344 / 251911223344 / +251911223344  ->  +251911223344
function normalizePhone(v) {
  v = orNull(v);
  if (!v) return null;
  const digits = String(v).replace(/[\s-]/g, '').replace(/^\+?251/, '').replace(/^0/, '');
  return `+251${digits}`;
}

function pick(data) {
  const v = {};
  FIELDS.forEach((f) => (v[f] = orNull(data[f])));
  v.phone = normalizePhone(data.phone);
  v.blood_group = v.blood_group || 'unknown';
  return v;
}

function pickContact(c) {
  if (!c) return null;
  const full_name = orNull(c.full_name);
  const phone = normalizePhone(c.phone);
  if (!full_name || !phone) return null;
  return { full_name, phone, relationship: orNull(c.relationship) || 'Other' };
}

async function findDuplicates(conn, v, excludeId) {
  const params = [v.first_name, v.father_name, v.date_of_birth, v.phone];
  let extra = '';
  if (excludeId) { extra = 'AND id <> ?'; params.push(excludeId); }
  const [rows] = await conn.query(
    `SELECT id, mrn, first_name, father_name, grandfather_name, gender, date_of_birth, phone
     FROM patients
     WHERE ((LOWER(first_name) = LOWER(?) AND LOWER(father_name) = LOWER(?) AND date_of_birth = ?)
            OR (phone IS NOT NULL AND phone = ?))
     ${extra} LIMIT 5`,
    params
  );
  return rows;
}

async function list({ search, status, page, limit }) {
  const where = [];
  const params = [];

  if (search) {
    const like = `%${search}%`;
    const digits = search.replace(/[\s-]/g, '');
    let phoneLike = like;
    if (/^\+?\d+$/.test(digits)) {
      const core = digits.replace(/^(\+?251|0)/, '');
      if (core) phoneLike = `%${core}%`;
    }
    where.push(`(p.mrn LIKE ? OR p.phone LIKE ? OR ${NAME_EXPR} LIKE ?)`);
    params.push(like, phoneLike, like);
  }
  if (['active', 'inactive', 'deceased'].includes(status)) {
    where.push('p.status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM patients p ${clause}`, params);
  const [items] = await pool.query(
    `SELECT p.id, p.mrn, p.first_name, p.father_name, p.grandfather_name, p.gender,
            p.date_of_birth, p.phone, p.region, p.status, p.created_at
     FROM patients p ${clause}
     ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// opts decides which clinical sections this user is allowed to see
async function getById(id, opts = {}) {
  const [[patient]] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
  if (!patient) throw new HttpError(404, 'Patient not found');

  const [contacts] = await pool.query(
    'SELECT id, full_name, relationship, phone FROM patient_contacts WHERE patient_id = ?', [id]
  );
  const result = { ...patient, contacts };

  if (opts.allergies) {
    [result.allergies] = await pool.query(
      `SELECT a.id, a.allergen, a.reaction, a.severity, a.created_at, u.full_name AS recorded_by
       FROM allergies a LEFT JOIN users u ON u.id = a.recorded_by
       WHERE a.patient_id = ?
       ORDER BY FIELD(a.severity, 'severe', 'moderate', 'mild'), a.created_at DESC`, [id]
    );
  }
  if (opts.appointments) {
    [result.appointments] = await pool.query(
      `SELECT a.id, a.appointment_date, a.start_time, a.type, a.status, a.reason, u.full_name AS doctor_name
       FROM appointments a JOIN users u ON u.id = a.doctor_id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 20`, [id]
    );
  }
  if (opts.visits) {
    [result.visits] = await pool.query(
      `SELECT e.id, e.encounter_type, e.status, e.chief_complaint, e.started_at, u.full_name AS doctor_name
       FROM encounters e LEFT JOIN users u ON u.id = e.doctor_id
       WHERE e.patient_id = ?
       ORDER BY e.started_at DESC LIMIT 20`, [id]
    );
  }
  return result;
}

async function create(data, userId, force) {
  const v = pick(data);
  if (!force) {
    const duplicates = await findDuplicates(pool, v);
    if (duplicates.length) return { duplicates };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const cols = [...FIELDS, 'mrn', 'created_by'];
    const [r] = await conn.query(
      `INSERT INTO patients (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      [...FIELDS.map((f) => v[f]), `T${crypto.randomBytes(8).toString('hex')}`, userId]
    );
    const mrn = await buildMrn(conn, r.insertId);
    await conn.query('UPDATE patients SET mrn = ? WHERE id = ?', [mrn, r.insertId]);

    const c = pickContact(data.emergency_contact);
    if (c) {
      await conn.query(
        'INSERT INTO patient_contacts (patient_id, full_name, relationship, phone) VALUES (?,?,?,?)',
        [r.insertId, c.full_name, c.relationship, c.phone]
      );
    }
    await conn.commit();
    return { patient: { id: r.insertId, mrn } };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function update(id, data) {
  const [[exists]] = await pool.query('SELECT id FROM patients WHERE id = ?', [id]);
  if (!exists) throw new HttpError(404, 'Patient not found');
  const v = pick(data);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE patients SET ${FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...FIELDS.map((f) => v[f]), id]
    );
    await conn.query('DELETE FROM patient_contacts WHERE patient_id = ?', [id]);
    const c = pickContact(data.emergency_contact);
    if (c) {
      await conn.query(
        'INSERT INTO patient_contacts (patient_id, full_name, relationship, phone) VALUES (?,?,?,?)',
        [id, c.full_name, c.relationship, c.phone]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Patients are never erased: "delete" only deactivates the record
async function deactivate(id) {
  const [r] = await pool.query("UPDATE patients SET status = 'inactive' WHERE id = ?", [id]);
  if (!r.affectedRows) throw new HttpError(404, 'Patient not found');
}

async function addAllergy(patientId, { allergen, reaction, severity }, userId) {
  const [[p]] = await pool.query('SELECT id FROM patients WHERE id = ?', [patientId]);
  if (!p) throw new HttpError(404, 'Patient not found');
  const [r] = await pool.query(
    'INSERT INTO allergies (patient_id, allergen, reaction, severity, recorded_by) VALUES (?,?,?,?,?)',
    [patientId, allergen.trim(), orNull(reaction), severity || 'mild', userId]
  );
  return r.insertId;
}

async function removeAllergy(patientId, allergyId) {
  const [[row]] = await pool.query(
    'SELECT id, allergen, severity FROM allergies WHERE id = ? AND patient_id = ?', [allergyId, patientId]
  );
  if (!row) throw new HttpError(404, 'Allergy record not found');
  await pool.query('DELETE FROM allergies WHERE id = ?', [allergyId]);
  return row;
}

module.exports = { list, getById, create, update, deactivate, addAllergy, removeAllergy };