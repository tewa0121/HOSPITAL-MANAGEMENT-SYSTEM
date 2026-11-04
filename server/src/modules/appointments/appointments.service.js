const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');

const SESSIONS = [['08:00', '12:00'], ['14:00', '17:00']]; // clinic hours

const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };
const toTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`;
const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getStep(conn) {
  const [[row]] = await conn.query(
    "SELECT setting_value FROM settings WHERE setting_key = 'appointment_slot_minutes'"
  );
  const n = Number(row?.setting_value);
  return n >= 5 ? n : 20;
}

function buildSlots(step) {
  const slots = [];
  for (const [s, e] of SESSIONS) {
    for (let m = toMin(s); m + step <= toMin(e); m += step) slots.push({ start: m, end: m + step });
  }
  return slots;
}

async function getDoctor(conn, id) {
  const [[d]] = await conn.query(
    `SELECT u.id, u.full_name, u.department_id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND r.name = 'doctor' AND u.is_active = 1`, [id]
  );
  if (!d) throw new HttpError(400, 'Selected doctor is not available');
  return d;
}

// All writes for one doctor are serialized by locking the doctor row.
// This is what prevents two receptionists booking the same slot.
const lockDoctor = (conn, doctorId) => conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [doctorId]);

async function lockAppointment(conn, id) {
  const [[pre]] = await conn.query('SELECT doctor_id FROM appointments WHERE id = ?', [id]);
  if (!pre) throw new HttpError(404, 'Appointment not found');
  await lockDoctor(conn, pre.doctor_id);
  const [[appt]] = await conn.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
  return appt;
}

function assertValidSlot(slots, startTime, date) {
  const slot = slots.find((s) => s.start === toMin(startTime));
  if (!slot) throw new HttpError(400, 'Selected time is not a valid appointment slot');
  const today = todayStr();
  if (date < today) throw new HttpError(400, 'Cannot book an appointment in the past');
  if (date === today && slot.start <= nowMin()) throw new HttpError(400, 'That time has already passed');
  return slot;
}

async function assertNoOverlap(conn, { doctorId, patientId, date, start, end, excludeId }) {
  const ex = excludeId ? ' AND id <> ?' : '';
  const base = `SELECT id FROM appointments
    WHERE appointment_date = ? AND type = 'scheduled' AND status NOT IN ('cancelled','no_show')
      AND start_time < ? AND end_time > ?${ex}`;
  const args = [date, toTime(end), toTime(start)];
  if (excludeId) args.push(excludeId);

  const [d] = await conn.query(`${base} AND doctor_id = ? LIMIT 1`, [...args, doctorId]);
  if (d.length) throw new HttpError(409, 'This doctor already has an appointment at that time');

  const [p] = await conn.query(`${base} AND patient_id = ? LIMIT 1`, [...args, patientId]);
  if (p.length) throw new HttpError(409, 'This patient already has an appointment at that time');
}

async function nextQueue(conn, doctorId, date) {
  const [[{ q }]] = await conn.query(
    'SELECT COALESCE(MAX(queue_number), 0) + 1 AS q FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
    [doctorId, date]
  );
  return q;
}

// Checking in creates the OPD encounter that the nurse and doctor will work on
const createEncounter = (conn, appt) =>
  conn.query(
    `INSERT INTO encounters (patient_id, appointment_id, doctor_id, encounter_type, status)
     VALUES (?, ?, ?, 'opd', 'waiting')`,
    [appt.patient_id, appt.id, appt.doctor_id]
  );

// ---------- public API ----------

async function listDoctors() {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.department_id, d.name AS department
     FROM users u JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE r.name = 'doctor' AND u.is_active = 1 ORDER BY u.full_name`
  );
  return rows;
}

async function getSlots(doctorId, date) {
  await getDoctor(pool, doctorId);
  const step = await getStep(pool);
  const [booked] = await pool.query(
    `SELECT start_time, end_time FROM appointments
     WHERE doctor_id = ? AND appointment_date = ? AND type = 'scheduled'
       AND status NOT IN ('cancelled','no_show')`,
    [doctorId, date]
  );
  const today = todayStr();
  return buildSlots(step).map((s) => {
    const taken = booked.some((b) => toMin(b.start_time) < s.end && toMin(b.end_time) > s.start);
    const past = date < today || (date === today && s.start <= nowMin());
    return {
      start: hhmm(s.start), end: hhmm(s.end),
      available: !taken && !past,
      reason: taken ? 'booked' : past ? 'past' : null,
    };
  });
}

async function list(f) {
  const where = [];
  const params = [];
  const date = f.date || (f.patient_id ? null : todayStr());
  if (date) { where.push('a.appointment_date = ?'); params.push(date); }
  if (f.doctor_id) { where.push('a.doctor_id = ?'); params.push(Number(f.doctor_id)); }
  if (f.patient_id) { where.push('a.patient_id = ?'); params.push(Number(f.patient_id)); }
  if (f.status) { where.push('a.status = ?'); params.push(f.status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.type, a.status, a.queue_number, a.reason,
            a.patient_id, p.mrn, CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name) AS patient_name,
            p.phone AS patient_phone, a.doctor_id, u.full_name AS doctor_name, d.name AS department,
            (SELECT e.id FROM encounters e WHERE e.appointment_id = a.id LIMIT 1) AS encounter_id
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.doctor_id
     LEFT JOIN departments d ON d.id = a.department_id
     ${clause}
     ORDER BY a.appointment_date, a.start_time LIMIT 300`,
    params
  );
  return rows;
}

async function create(data, userId) {
  const walkIn = data.type === 'walk_in';

  return tx(async (conn) => {
    const [[patient]] = await conn.query('SELECT id, status FROM patients WHERE id = ?', [data.patient_id]);
    if (!patient) throw new HttpError(404, 'Patient not found');
    if (patient.status !== 'active') throw new HttpError(400, 'This patient record is not active');

    const doctor = await getDoctor(conn, data.doctor_id);
    await lockDoctor(conn, doctor.id);
    const step = await getStep(conn);

    let date, startMin, queue = null;
    if (walkIn) {
      date = todayStr();
      startMin = nowMin();
      const [inQueue] = await conn.query(
        `SELECT id FROM appointments WHERE patient_id = ? AND appointment_date = ?
           AND status IN ('checked_in','in_consultation') LIMIT 1`, [patient.id, date]
      );
      if (inQueue.length) throw new HttpError(409, 'This patient is already in the queue today');
      queue = await nextQueue(conn, doctor.id, date);
    } else {
      date = data.appointment_date;
      const slot = assertValidSlot(buildSlots(step), data.start_time, date);
      startMin = slot.start;
      await assertNoOverlap(conn, {
        doctorId: doctor.id, patientId: patient.id, date, start: startMin, end: startMin + step,
      });
    }
    const endMin = Math.min(startMin + step, 1439);

    const [r] = await conn.query(
      `INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, start_time, end_time,
                                 type, status, queue_number, reason, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [patient.id, doctor.id, doctor.department_id, date, toTime(startMin), toTime(endMin),
       walkIn ? 'walk_in' : 'scheduled', walkIn ? 'checked_in' : 'scheduled', queue,
       (data.reason || '').trim() || null, userId]
    );
    if (walkIn) {
      await createEncounter(conn, { id: r.insertId, patient_id: patient.id, doctor_id: doctor.id });
    }
    return { id: r.insertId, queue_number: queue };
  });
}

async function checkIn(id) {
  return tx(async (conn) => {
    const appt = await lockAppointment(conn, id);
    if (appt.status !== 'scheduled') throw new HttpError(400, 'Only scheduled appointments can be checked in');
    if (appt.appointment_date !== todayStr()) throw new HttpError(400, "Only today's appointments can be checked in");

    const queue = await nextQueue(conn, appt.doctor_id, appt.appointment_date);
    await conn.query("UPDATE appointments SET status = 'checked_in', queue_number = ? WHERE id = ?", [queue, id]);
    await createEncounter(conn, appt);
    return { id, queue_number: queue };
  });
}

async function cancel(id) {
  return tx(async (conn) => {
    const appt = await lockAppointment(conn, id);
    if (!['scheduled', 'checked_in'].includes(appt.status)) {
      throw new HttpError(400, 'This appointment can no longer be cancelled');
    }
    await conn.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [id]);
    await conn.query(
      "UPDATE encounters SET status = 'cancelled', closed_at = NOW() WHERE appointment_id = ? AND status = 'waiting'", [id]
    );
  });
}

async function reschedule(id, { appointment_date, start_time }) {
  return tx(async (conn) => {
    const appt = await lockAppointment(conn, id);
    if (appt.status !== 'scheduled') throw new HttpError(400, 'Only scheduled appointments can be rescheduled');

    const step = await getStep(conn);
    const slot = assertValidSlot(buildSlots(step), start_time, appointment_date);
    await assertNoOverlap(conn, {
      doctorId: appt.doctor_id, patientId: appt.patient_id, date: appointment_date,
      start: slot.start, end: slot.end, excludeId: id,
    });
    await conn.query(
      'UPDATE appointments SET appointment_date = ?, start_time = ?, end_time = ? WHERE id = ?',
      [appointment_date, toTime(slot.start), toTime(slot.end), id]
    );
  });
}

async function noShow(id) {
  return tx(async (conn) => {
    const appt = await lockAppointment(conn, id);
    if (appt.status !== 'scheduled') throw new HttpError(400, 'Only scheduled appointments can be marked as no-show');
    if (appt.appointment_date > todayStr()) throw new HttpError(400, 'This appointment is in the future');
    await conn.query("UPDATE appointments SET status = 'no_show' WHERE id = ?", [id]);
  });
}

module.exports = { listDoctors, getSlots, list, create, checkIn, cancel, reschedule, noShow };