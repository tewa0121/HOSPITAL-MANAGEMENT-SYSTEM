const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const withTransaction = require('../../utils/transaction');

const ACTIVE = ['in_consultation', 'awaiting_results'];
const OPEN = ['waiting', 'triaged', ...ACTIVE];
const PENDING_LAB = ['ordered', 'collected', 'processing', 'resulted'];
const NAME = "CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name)";

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const orNull = (v) => {
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
};

// Simple allergy check by drug name and drug family (demo level, not a full interaction database)
const FAMILIES = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin'],
  sulfa: ['sulfa', 'sulfamethoxazole', 'cotrimoxazole'],
  nsaid: ['nsaid', 'ibuprofen', 'diclofenac', 'aspirin'],
  cephalosporin: ['cephalosporin', 'ceftriaxone', 'cefalexin', 'cefixime'],
};
function allergyTerms(allergen) {
  const a = allergen.toLowerCase().trim();
  const terms = new Set([a]);
  Object.entries(FAMILIES).forEach(([key, list]) => {
    if (a.includes(key) || list.some((x) => a.includes(x))) list.forEach((x) => terms.add(x));
  });
  return [...terms];
}

// ---------- helpers ----------
async function loadEncounter(conn, id, lock = false) {
  const [[enc]] = await conn.query(`SELECT * FROM encounters WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!enc) throw new HttpError(404, 'Visit not found');
  return enc;
}

// Resource-level rule: a doctor can only work on their own visits
function assertAccess(enc, user) {
  if (user.role === 'doctor' && enc.doctor_id !== user.id) {
    throw new HttpError(403, 'This visit belongs to another doctor');
  }
}

function assertState(enc, allowed, message) {
  if (!allowed.includes(enc.status)) throw new HttpError(400, message);
}

const NOT_ACTIVE = 'Start the consultation first (or this visit is already closed)';

async function pendingLabCount(conn, encId) {
  const [[{ n }]] = await conn.query(
    'SELECT COUNT(*) AS n FROM lab_orders WHERE encounter_id = ? AND status IN (?)', [encId, PENDING_LAB]
  );
  return n;
}

// ---------- queue ----------
async function list(f, user) {
  const where = ['DATE(e.started_at) = ?'];
  const params = [/^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : todayStr()];

  const statuses = ['waiting', 'triaged', 'in_consultation', 'awaiting_results', 'completed', 'cancelled'];
  if (statuses.includes(f.status)) { where.push('e.status = ?'); params.push(f.status); }
  else where.push("e.status <> 'cancelled'");

  if (user.role === 'doctor') { where.push('e.doctor_id = ?'); params.push(user.id); }
  else if (f.doctor_id) { where.push('e.doctor_id = ?'); params.push(Number(f.doctor_id)); }

  const [rows] = await pool.query(
    `SELECT e.id, e.status, e.encounter_type, e.started_at, e.chief_complaint, e.patient_id, e.doctor_id,
            p.mrn, ${NAME} AS patient_name, p.gender, p.date_of_birth,
            u.full_name AS doctor_name, a.queue_number,
            (SELECT COUNT(*) FROM vital_signs v WHERE v.encounter_id = e.id) AS vitals_count,
            (SELECT COUNT(*) FROM allergies al WHERE al.patient_id = p.id AND al.severity = 'severe') AS severe_allergies
     FROM encounters e
     JOIN patients p ON p.id = e.patient_id
     LEFT JOIN users u ON u.id = e.doctor_id
     LEFT JOIN appointments a ON a.id = e.appointment_id
     WHERE ${where.join(' AND ')}
     ORDER BY FIELD(e.status, 'waiting','triaged','in_consultation','awaiting_results','completed','cancelled'),
              COALESCE(a.queue_number, 9999), e.id
     LIMIT 300`,
    params
  );
  return rows;
}

// ---------- one visit ----------
async function detail(id, user) {
  const has = (...codes) => codes.some((c) => user.permissions.includes(c));

  const [[enc]] = await pool.query(
    `SELECT e.*, u.full_name AS doctor_name, a.queue_number, a.reason AS appointment_reason
     FROM encounters e
     LEFT JOIN users u ON u.id = e.doctor_id
     LEFT JOIN appointments a ON a.id = e.appointment_id
     WHERE e.id = ?`, [id]
  );
  if (!enc) throw new HttpError(404, 'Visit not found');
  assertAccess(enc, user);

  const [[patient]] = await pool.query(
    `SELECT id, mrn, first_name, father_name, grandfather_name, gender, date_of_birth, phone, blood_group
     FROM patients WHERE id = ?`, [enc.patient_id]
  );
  const [allergies] = await pool.query(
    `SELECT id, allergen, reaction, severity FROM allergies WHERE patient_id = ?
     ORDER BY FIELD(severity, 'severe','moderate','mild')`, [enc.patient_id]
  );
  const result = { ...enc, patient, allergies };

  if (has('vitals.read')) {
    [result.vitals] = await pool.query(
      `SELECT v.*, u.full_name AS recorded_by_name FROM vital_signs v
       LEFT JOIN users u ON u.id = v.recorded_by
       WHERE v.encounter_id = ? ORDER BY v.recorded_at DESC, v.id DESC`, [id]
    );
  }
  if (has('diagnoses.read')) {
    [result.diagnoses] = await pool.query(
      'SELECT id, icd10_code, description, type, created_at FROM diagnoses WHERE encounter_id = ? ORDER BY FIELD(type, "primary","secondary"), id',
      [id]
    );
  }
  if (has('lab.read')) {
    const [orders] = await pool.query(
      `SELECT lo.id, lo.test_id, lo.status, lo.priority, lo.created_at, lo.verified_at,
              lo.result_value, lo.result_flag, lo.result_comment, lo.reject_reason,
              t.code, t.name, t.unit, t.ref_text
       FROM lab_orders lo JOIN lab_tests t ON t.id = lo.test_id
       WHERE lo.encounter_id = ? ORDER BY lo.id`, [id]
    );
    // Results are only released to the clinician after verification
    result.lab_orders = orders.map((o) =>
      o.status === 'verified' ? o : { ...o, result_value: null, result_flag: null, result_comment: null }
    );
  }
  if (has('prescriptions.read')) {
    const [rx] = await pool.query(
      `SELECT rx.id, rx.status, rx.notes, rx.created_at, u.full_name AS doctor_name
       FROM prescriptions rx JOIN users u ON u.id = rx.doctor_id
       WHERE rx.encounter_id = ? ORDER BY rx.id DESC`, [id]
    );
    if (rx.length) {
      const [items] = await pool.query(
        `SELECT pi.id, pi.prescription_id, pi.dosage, pi.frequency, pi.duration_days, pi.quantity,
                pi.quantity_dispensed, pi.instructions, m.generic_name, m.brand_name, m.form, m.strength
         FROM prescription_items pi JOIN medications m ON m.id = pi.medication_id
         WHERE pi.prescription_id IN (?) ORDER BY pi.id`, [rx.map((r) => r.id)]
      );
      rx.forEach((r) => { r.items = items.filter((i) => i.prescription_id === r.id); });
    }
    result.prescriptions = rx;
  }
  return result;
}

// ---------- nurse ----------
async function addVitals(id, v, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertState(enc, OPEN, 'This visit is already closed');
    const [r] = await conn.query(
      `INSERT INTO vital_signs (encounter_id, patient_id, temperature_c, pulse, respiratory_rate,
                                bp_systolic, bp_diastolic, spo2, weight_kg, height_cm, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, enc.patient_id, v.temperature_c, v.pulse, v.respiratory_rate, v.bp_systolic,
       v.bp_diastolic, v.spo2, v.weight_kg, v.height_cm, user.id]
    );
    if (enc.status === 'waiting') await conn.query("UPDATE encounters SET status = 'triaged' WHERE id = ?", [id]);
    return r.insertId;
  });
}

// ---------- doctor ----------
async function start(id, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ['waiting', 'triaged'], 'This visit has already been started or closed');
    await conn.query(
      "UPDATE encounters SET status = 'in_consultation', doctor_id = COALESCE(doctor_id, ?) WHERE id = ?",
      [user.role === 'doctor' ? user.id : null, id]
    );
    if (enc.appointment_id) {
      await conn.query("UPDATE appointments SET status = 'in_consultation' WHERE id = ?", [enc.appointment_id]);
    }
  });
}

async function saveNotes(id, d, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);
    await conn.query(
      `UPDATE encounters SET chief_complaint = ?, history_present_illness = ?, examination = ?,
              treatment_plan = ?, follow_up_date = ? WHERE id = ?`,
      [orNull(d.chief_complaint), orNull(d.history_present_illness), orNull(d.examination),
       orNull(d.treatment_plan), orNull(d.follow_up_date), id]
    );
  });
}

async function addDiagnosis(id, d, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);
    if (d.type === 'primary') {
      const [p] = await conn.query("SELECT id FROM diagnoses WHERE encounter_id = ? AND type = 'primary' LIMIT 1", [id]);
      if (p.length) throw new HttpError(409, 'A primary diagnosis already exists. Add this one as secondary.');
    }
    const [r] = await conn.query(
      `INSERT INTO diagnoses (encounter_id, patient_id, icd10_code, description, type, created_by)
       VALUES (?,?,?,?,?,?)`,
      [id, enc.patient_id, orNull(d.icd10_code) && d.icd10_code.trim().toUpperCase(), d.description.trim(),
       d.type || 'primary', user.id]
    );
    return r.insertId;
  });
}

async function removeDiagnosis(id, diagId, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);
    const [[row]] = await conn.query(
      'SELECT id, icd10_code, description, type FROM diagnoses WHERE id = ? AND encounter_id = ?', [diagId, id]
    );
    if (!row) throw new HttpError(404, 'Diagnosis not found');
    await conn.query('DELETE FROM diagnoses WHERE id = ?', [diagId]);
    return row;
  });
}

async function orderLabs(id, { test_ids, priority }, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);

    const ids = [...new Set(test_ids.map(Number))];
    const [tests] = await conn.query('SELECT id, name FROM lab_tests WHERE id IN (?) AND is_active = 1', [ids]);
    if (tests.length !== ids.length) throw new HttpError(400, 'One or more selected tests are not available');

    const [existing] = await conn.query(
      "SELECT test_id FROM lab_orders WHERE encounter_id = ? AND status NOT IN ('cancelled','rejected') AND test_id IN (?)",
      [id, ids]
    );
    const dup = new Set(existing.map((r) => r.test_id));
    const toCreate = tests.filter((t) => !dup.has(t.id));
    if (!toCreate.length) throw new HttpError(409, 'These tests are already ordered for this visit');

    for (const t of toCreate) {
      await conn.query(
        'INSERT INTO lab_orders (encounter_id, patient_id, test_id, ordered_by, priority) VALUES (?,?,?,?,?)',
        [id, enc.patient_id, t.id, user.id, priority || 'routine']
      );
    }
    await conn.query("UPDATE encounters SET status = 'awaiting_results' WHERE id = ? AND status = 'in_consultation'", [id]);
    return { created: toCreate.length, skipped: dup.size };
  });
}

async function cancelLab(id, orderId, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);
    const [[order]] = await conn.query('SELECT id, status FROM lab_orders WHERE id = ? AND encounter_id = ? FOR UPDATE', [orderId, id]);
    if (!order) throw new HttpError(404, 'Lab order not found');
    if (order.status !== 'ordered') throw new HttpError(400, 'The laboratory has already started this test');
    await conn.query("UPDATE lab_orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    if (enc.status === 'awaiting_results' && (await pendingLabCount(conn, id)) === 0) {
      await conn.query("UPDATE encounters SET status = 'in_consultation' WHERE id = ?", [id]);
    }
  });
}

async function prescribe(id, { items, notes, override }, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);

    const medIds = items.map((i) => Number(i.medication_id));
    if (new Set(medIds).size !== medIds.length) throw new HttpError(400, 'The same medication appears twice');
    const [meds] = await conn.query(
      'SELECT id, generic_name, brand_name FROM medications WHERE id IN (?) AND is_active = 1', [medIds]
    );
    if (meds.length !== medIds.length) throw new HttpError(400, 'One or more medications are not available');

    // Allergy safety check
    const [allergies] = await conn.query('SELECT allergen, severity FROM allergies WHERE patient_id = ?', [enc.patient_id]);
    const conflicts = [];
    meds.forEach((m) => {
      const names = [m.generic_name, m.brand_name].filter(Boolean).map((s) => s.toLowerCase());
      allergies.forEach((a) => {
        const hit = allergyTerms(a.allergen).some((term) => term.length >= 3 && names.some((n) => n.includes(term)));
        if (hit) conflicts.push({ medication: m.generic_name, allergen: a.allergen, severity: a.severity });
      });
    });
    if (conflicts.length && !override) return { conflicts };

    const [rx] = await conn.query(
      'INSERT INTO prescriptions (encounter_id, patient_id, doctor_id, notes) VALUES (?,?,?,?)',
      [id, enc.patient_id, user.id, orNull(notes)]
    );
    for (const it of items) {
      await conn.query(
        `INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity, instructions)
         VALUES (?,?,?,?,?,?,?)`,
        [rx.insertId, it.medication_id, it.dosage.trim(), it.frequency.trim(), it.duration_days, it.quantity, orNull(it.instructions)]
      );
    }
    return { id: rx.insertId, overridden: conflicts.length > 0, conflicts };
  });
}

async function cancelPrescription(id, rxId, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);
    const [[rx]] = await conn.query('SELECT id, status FROM prescriptions WHERE id = ? AND encounter_id = ? FOR UPDATE', [rxId, id]);
    if (!rx) throw new HttpError(404, 'Prescription not found');
    if (rx.status !== 'pending') throw new HttpError(400, 'The pharmacy has already started dispensing this prescription');
    await conn.query("UPDATE prescriptions SET status = 'cancelled' WHERE id = ?", [rxId]);
  });
}

async function close(id, force, user) {
  return withTransaction(async (conn) => {
    const enc = await loadEncounter(conn, id, true);
    assertAccess(enc, user);
    assertState(enc, ACTIVE, NOT_ACTIVE);

    const [[{ n: dx }]] = await conn.query('SELECT COUNT(*) AS n FROM diagnoses WHERE encounter_id = ?', [id]);
    if (!dx) throw new HttpError(400, 'Add at least one diagnosis before completing the visit');

    const pending = await pendingLabCount(conn, id);
    if (pending && !force) return { pending };

    await conn.query("UPDATE encounters SET status = 'completed', closed_at = NOW() WHERE id = ?", [id]);
    if (enc.appointment_id) {
      await conn.query("UPDATE appointments SET status = 'completed' WHERE id = ?", [enc.appointment_id]);
    }
    return { closed: true, pending };
  });
}

// ---------- pickers ----------
async function labTests() {
  const [rows] = await pool.query(
    `SELECT t.id, t.code, t.name, t.category, t.specimen, s.price
     FROM lab_tests t LEFT JOIN service_catalog s ON s.id = t.service_id
     WHERE t.is_active = 1 ORDER BY t.category, t.name`
  );
  return rows;
}

async function medications() {
  const [rows] = await pool.query(
    `SELECT m.id, m.generic_name, m.brand_name, m.form, m.strength,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity_available END), 0) AS stock
     FROM medications m LEFT JOIN medication_batches b ON b.medication_id = m.id
     WHERE m.is_active = 1 GROUP BY m.id ORDER BY m.generic_name`
  );
  return rows;
}

module.exports = {
  list, detail, addVitals, start, saveNotes, addDiagnosis, removeDiagnosis,
  orderLabs, cancelLab, prescribe, cancelPrescription, close, labTests, medications,
};