const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const withTransaction = require('../../utils/transaction');
const { findConflicts } = require('../../utils/allergy');

const NAME = "CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name)";
const EXPIRY_DAYS = 90; // "expiring soon" window
const ACTIVE_RX = ['pending', 'partially_dispensed'];

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
const round2 = (n) => Math.round(n * 100) / 100;
const label = (m) => [m.generic_name, m.strength].filter(Boolean).join(' ');

// ======================= STOCK =======================

async function stockRows(includeInactive) {
  const [rows] = await pool.query(
    `SELECT m.id, m.generic_name, m.brand_name, m.form, m.strength, m.unit_price, m.reorder_level,
            m.is_controlled, m.is_active,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity_available ELSE 0 END), 0) AS stock,
            COALESCE(SUM(CASE WHEN b.expiry_date < CURDATE() THEN b.quantity_available ELSE 0 END), 0) AS expired_qty,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE()
                               AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${EXPIRY_DAYS} DAY)
                              THEN b.quantity_available ELSE 0 END), 0) AS expiring_qty,
            MIN(CASE WHEN b.expiry_date >= CURDATE() AND b.quantity_available > 0 THEN b.expiry_date END) AS next_expiry
     FROM medications m
     LEFT JOIN medication_batches b ON b.medication_id = m.id
     ${includeInactive ? '' : 'WHERE m.is_active = 1'}
     GROUP BY m.id
     ORDER BY m.generic_name, m.strength`
  );
  return rows.map((r) => {
    const stock = Number(r.stock);
    const reorder = Number(r.reorder_level);
    return {
      id: r.id, generic_name: r.generic_name, brand_name: r.brand_name, form: r.form, strength: r.strength,
      unit_price: Number(r.unit_price), reorder_level: reorder,
      is_controlled: !!r.is_controlled, is_active: !!r.is_active,
      stock, expired_qty: Number(r.expired_qty), expiring_qty: Number(r.expiring_qty),
      next_expiry: r.next_expiry,
      status: stock === 0 ? 'out' : stock <= reorder ? 'low' : 'ok',
    };
  });
}

function summarize(rows) {
  const active = rows.filter((r) => r.is_active);
  return {
    medications: active.length,
    out: active.filter((r) => r.status === 'out').length,
    low: active.filter((r) => r.status === 'low').length,
    expiring: active.filter((r) => r.expiring_qty > 0).length,
    expired: rows.filter((r) => r.expired_qty > 0).length,
    value: round2(active.reduce((s, r) => s + r.stock * r.unit_price, 0)),
  };
}

async function listStock(f, user) {
  const manager = user.permissions.includes('pharmacy.stock_manage');
  const rows = await stockRows(manager);
  const summary = summarize(rows);

  let items = rows;
  const q = (f.search || '').trim().toLowerCase();
  if (q) items = items.filter((r) => `${r.generic_name} ${r.brand_name || ''}`.toLowerCase().includes(q));
  if (f.alert === 'low') items = items.filter((r) => r.status !== 'ok');
  else if (f.alert === 'out') items = items.filter((r) => r.status === 'out');
  else if (f.alert === 'expiring') items = items.filter((r) => r.expiring_qty > 0);
  else if (f.alert === 'expired') items = items.filter((r) => r.expired_qty > 0);

  return { items, summary };
}

async function listBatches(medId) {
  const [[med]] = await pool.query(
    'SELECT id, generic_name, brand_name, form, strength FROM medications WHERE id = ?', [medId]
  );
  if (!med) throw new HttpError(404, 'Medication not found');
  const [batches] = await pool.query(
    `SELECT id, batch_no, expiry_date, quantity_received, quantity_available, received_at,
            DATEDIFF(expiry_date, CURDATE()) AS days_left
     FROM medication_batches WHERE medication_id = ? ORDER BY expiry_date, id`, [medId]
  );
  return { medication: med, batches };
}

async function receive(d) {
  return withTransaction(async (conn) => {
    const [[med]] = await conn.query(
      'SELECT id, generic_name, strength, is_active FROM medications WHERE id = ? FOR UPDATE', [d.medication_id]
    );
    if (!med) throw new HttpError(404, 'Medication not found');
    if (!med.is_active) throw new HttpError(400, 'This medication is inactive');

    const [[{ days }]] = await conn.query('SELECT DATEDIFF(?, CURDATE()) AS days', [d.expiry_date]);
    if (days <= 0) throw new HttpError(422, 'Expiry date must be in the future');

    const qty = Number(d.quantity);
    const [[existing]] = await conn.query(
      'SELECT * FROM medication_batches WHERE medication_id = ? AND batch_no = ? FOR UPDATE', [med.id, d.batch_no]
    );

    if (existing) {
      if (existing.expiry_date !== d.expiry_date) {
        throw new HttpError(409, 'This batch number already exists with a different expiry date');
      }
      await conn.query(
        'UPDATE medication_batches SET quantity_received = quantity_received + ?, quantity_available = quantity_available + ? WHERE id = ?',
        [qty, qty, existing.id]
      );
      return { medication: label(med), batch_no: d.batch_no, quantity: qty, topped_up: true };
    }

    await conn.query(
      `INSERT INTO medication_batches (medication_id, batch_no, expiry_date, quantity_received, quantity_available)
       VALUES (?,?,?,?,?)`,
      [med.id, d.batch_no, d.expiry_date, qty, qty]
    );
    return { medication: label(med), batch_no: d.batch_no, expiry_date: d.expiry_date, quantity: qty, topped_up: false };
  });
}

// Stock only ever goes DOWN through an adjustment. The reason is kept in the audit log.
async function adjust(batchId, d) {
  if (['lost', 'count_correction'].includes(d.reason_type) && (!d.note || d.note.trim().length < 3)) {
    throw new HttpError(422, 'Enter a note explaining the adjustment');
  }
  return withTransaction(async (conn) => {
    const [[b]] = await conn.query('SELECT * FROM medication_batches WHERE id = ? FOR UPDATE', [batchId]);
    if (!b) throw new HttpError(404, 'Batch not found');
    const qty = Number(d.quantity);
    if (qty > b.quantity_available) {
      throw new HttpError(400, `Only ${b.quantity_available} unit(s) are available in this batch`);
    }
    await conn.query('UPDATE medication_batches SET quantity_available = quantity_available - ? WHERE id = ?', [qty, batchId]);
    const [[m]] = await conn.query('SELECT generic_name, strength FROM medications WHERE id = ?', [b.medication_id]);
    return {
      medication: label(m), batch_no: b.batch_no, reason_type: d.reason_type, note: orNull(d.note),
      removed: qty, before: b.quantity_available, after: b.quantity_available - qty,
    };
  });
}

// ======================= MEDICATION CATALOG =======================

async function assertUnique(d, excludeId = 0) {
  const [dup] = await pool.query(
    `SELECT id FROM medications
     WHERE LOWER(generic_name) = LOWER(?) AND LOWER(form) = LOWER(?)
       AND COALESCE(LOWER(strength), '') = COALESCE(LOWER(?), '') AND id <> ? LIMIT 1`,
    [d.generic_name.trim(), d.form, orNull(d.strength), excludeId]
  );
  if (dup.length) throw new HttpError(409, 'This medication (same name, form and strength) already exists');
}

async function createMedication(d) {
  await assertUnique(d);
  const [r] = await pool.query(
    `INSERT INTO medications (generic_name, brand_name, form, strength, unit_price, reorder_level, is_controlled)
     VALUES (?,?,?,?,?,?,?)`,
    [d.generic_name.trim(), orNull(d.brand_name), d.form, orNull(d.strength), Number(d.unit_price),
     Number(d.reorder_level), flag(d.is_controlled, 0)]
  );
  return r.insertId;
}

async function updateMedication(id, d) {
  const [[m]] = await pool.query('SELECT id, unit_price FROM medications WHERE id = ?', [id]);
  if (!m) throw new HttpError(404, 'Medication not found');
  await assertUnique(d, id);
  await pool.query(
    `UPDATE medications SET generic_name = ?, brand_name = ?, form = ?, strength = ?, unit_price = ?,
            reorder_level = ?, is_controlled = ?, is_active = ? WHERE id = ?`,
    [d.generic_name.trim(), orNull(d.brand_name), d.form, orNull(d.strength), Number(d.unit_price),
     Number(d.reorder_level), flag(d.is_controlled, 0), flag(d.is_active, 1), id]
  );
  return { generic_name: d.generic_name.trim(), old_price: Number(m.unit_price), new_price: Number(d.unit_price) };
}

// ======================= PRESCRIPTIONS =======================

async function listPrescriptions(f, user) {
  const isDoctor = user.role === 'doctor';
  const status = ['active', 'dispensed', 'cancelled', 'all'].includes(f.status) ? f.status : 'active';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : todayStr();

  const where = [];
  const params = [];
  if (status === 'active') where.push("rx.status IN ('pending','partially_dispensed')");
  else if (status === 'dispensed') {
    where.push("rx.status = 'dispensed'");
    where.push(`EXISTS (SELECT 1 FROM dispensing d JOIN prescription_items pi2 ON pi2.id = d.prescription_item_id
                        WHERE pi2.prescription_id = rx.id AND DATE(d.dispensed_at) = ?)`);
    params.push(date);
  } else if (status === 'cancelled') {
    where.push("rx.status = 'cancelled'", 'DATE(rx.created_at) = ?');
    params.push(date);
  } else {
    where.push('DATE(rx.created_at) = ?');
    params.push(date);
  }

  const q = (f.search || '').trim();
  if (q) {
    where.push(`(p.mrn LIKE ? OR ${NAME} LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  // Resource-level rule: a doctor only sees their own prescriptions
  if (isDoctor) { where.push('rx.doctor_id = ?'); params.push(user.id); }

  const [rows] = await pool.query(
    `SELECT rx.id, rx.status, rx.created_at, rx.encounter_id, rx.patient_id,
            p.mrn, ${NAME} AS patient_name, p.gender, p.date_of_birth, u.full_name AS doctor_name,
            (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = rx.id) AS item_count,
            (SELECT COALESCE(SUM(pi.quantity - pi.quantity_dispensed), 0) FROM prescription_items pi WHERE pi.prescription_id = rx.id) AS remaining,
            (SELECT COUNT(*) FROM allergies al WHERE al.patient_id = p.id AND al.severity = 'severe') AS severe_allergies,
            (SELECT GROUP_CONCAT(m.generic_name ORDER BY pi.id SEPARATOR ', ')
               FROM prescription_items pi JOIN medications m ON m.id = pi.medication_id
              WHERE pi.prescription_id = rx.id) AS medicines
     FROM prescriptions rx
     JOIN patients p ON p.id = rx.patient_id
     JOIN users u ON u.id = rx.doctor_id
     WHERE ${where.join(' AND ')}
     ORDER BY rx.created_at ${status === 'active' ? 'ASC' : 'DESC'}, rx.id
     LIMIT 300`,
    params
  );

  const own = isDoctor ? ' AND rx.doctor_id = ?' : '';
  const ownP = isDoctor ? [user.id] : [];
  const [counts] = await pool.query(
    `SELECT rx.status, COUNT(*) AS n FROM prescriptions rx
     WHERE rx.status IN ('pending','partially_dispensed')${own} GROUP BY rx.status`, ownP
  );
  const [[today]] = await pool.query(
    `SELECT COUNT(DISTINCT pi.prescription_id) AS n
     FROM dispensing d
     JOIN prescription_items pi ON pi.id = d.prescription_item_id
     JOIN prescriptions rx ON rx.id = pi.prescription_id
     WHERE DATE(d.dispensed_at) = CURDATE()${own}`, ownP
  );
  const c = (s) => counts.find((x) => x.status === s)?.n || 0;

  const summary = { pending: c('pending'), partial: c('partially_dispensed'), dispensed_today: today.n, stock: null };
  if (user.permissions.includes('pharmacy.stock_read')) {
    const s = summarize(await stockRows(false));
    summary.stock = { low_out: s.low + s.out, expiring: s.expiring, expired: s.expired };
  }

  return { items: rows.map((r) => ({ ...r, remaining: Number(r.remaining) })), summary };
}

async function prescriptionDetail(id, user) {
  const [[rx]] = await pool.query(
    `SELECT rx.id, rx.status, rx.notes, rx.created_at, rx.encounter_id, rx.patient_id, rx.doctor_id,
            u.full_name AS doctor_name
     FROM prescriptions rx JOIN users u ON u.id = rx.doctor_id WHERE rx.id = ?`, [id]
  );
  if (!rx) throw new HttpError(404, 'Prescription not found');
  if (user.role === 'doctor' && rx.doctor_id !== user.id) {
    throw new HttpError(403, 'This prescription belongs to another doctor');
  }

  const [[patient]] = await pool.query(
    `SELECT id, mrn, first_name, father_name, grandfather_name, gender, date_of_birth, blood_group
     FROM patients WHERE id = ?`, [rx.patient_id]
  );
  const [allergies] = await pool.query(
    `SELECT id, allergen, reaction, severity FROM allergies WHERE patient_id = ?
     ORDER BY FIELD(severity, 'severe','moderate','mild')`, [rx.patient_id]
  );
  const [items] = await pool.query(
    `SELECT pi.id, pi.medication_id, pi.dosage, pi.frequency, pi.duration_days, pi.quantity,
            pi.quantity_dispensed, pi.instructions,
            m.generic_name, m.brand_name, m.form, m.strength, m.is_controlled, m.unit_price
     FROM prescription_items pi JOIN medications m ON m.id = pi.medication_id
     WHERE pi.prescription_id = ? ORDER BY pi.id`, [id]
  );

  const active = ACTIVE_RX.includes(rx.status);
  const detailed = [];
  for (const it of items) {
    const remaining = it.quantity - it.quantity_dispensed;
    let batches = [];
    if (active && remaining > 0) {
      [batches] = await pool.query(
        `SELECT id, batch_no, expiry_date, quantity_available FROM medication_batches
         WHERE medication_id = ? AND expiry_date >= CURDATE() AND quantity_available > 0
         ORDER BY expiry_date, id`, [it.medication_id]
      );
    }
    detailed.push({
      ...it, is_controlled: !!it.is_controlled, unit_price: Number(it.unit_price),
      remaining, batches, available: batches.reduce((s, b) => s + b.quantity_available, 0),
    });
  }

  const [history] = await pool.query(
    `SELECT d.id, d.quantity, d.dispensed_at, b.batch_no, b.expiry_date, m.generic_name, m.strength,
            u.full_name AS dispensed_by_name
     FROM dispensing d
     JOIN prescription_items pi ON pi.id = d.prescription_item_id
     JOIN medication_batches b ON b.id = d.batch_id
     JOIN medications m ON m.id = pi.medication_id
     JOIN users u ON u.id = d.dispensed_by
     WHERE pi.prescription_id = ? ORDER BY d.dispensed_at DESC, d.id DESC`, [id]
  );

  const conflicts = active ? findConflicts(allergies, detailed.filter((i) => i.remaining > 0)) : [];
  return { ...rx, patient, allergies, items: detailed, history, conflicts };
}

async function dispense(id, { items, override, override_reason }, user) {
  return withTransaction(async (conn) => {
    // Lock order everywhere: visit -> prescription -> items -> batches
    const [[pre]] = await conn.query('SELECT encounter_id FROM prescriptions WHERE id = ?', [id]);
    if (!pre) throw new HttpError(404, 'Prescription not found');
    await conn.query('SELECT id FROM encounters WHERE id = ? FOR UPDATE', [pre.encounter_id]);
    const [[rx]] = await conn.query('SELECT * FROM prescriptions WHERE id = ? FOR UPDATE', [id]);
    if (!ACTIVE_RX.includes(rx.status)) {
      throw new HttpError(400, rx.status === 'cancelled'
        ? 'This prescription was cancelled and cannot be dispensed'
        : 'This prescription is already fully dispensed');
    }

    const [pItems] = await conn.query('SELECT * FROM prescription_items WHERE prescription_id = ? FOR UPDATE', [id]);
    const [meds] = await conn.query(
      `SELECT m.id, m.generic_name, m.brand_name, m.strength, m.is_controlled
       FROM medications m WHERE m.id IN (?)`, [pItems.map((i) => i.medication_id)]
    );
    const medById = Object.fromEntries(meds.map((m) => [m.id, m]));

    // validate the request
    const seen = new Set();
    const todo = [];
    for (const r of items) {
      const qty = Number(r.quantity);
      if (!qty) continue;
      const itemId = Number(r.item_id);
      if (seen.has(itemId)) throw new HttpError(400, 'The same medication appears twice');
      seen.add(itemId);
      const item = pItems.find((x) => x.id === itemId);
      if (!item) throw new HttpError(400, 'A selected medication is not part of this prescription');
      const remaining = item.quantity - item.quantity_dispensed;
      if (qty > remaining) {
        throw new HttpError(400, `${label(medById[item.medication_id])}: only ${remaining} unit(s) remain to be dispensed`);
      }
      todo.push({ item, qty, med: medById[item.medication_id] });
    }
    if (!todo.length) throw new HttpError(422, 'Enter a quantity for at least one medication');

    // allergy re-check at the moment of dispensing
    const [allergies] = await conn.query('SELECT allergen, severity FROM allergies WHERE patient_id = ?', [rx.patient_id]);
    const conflicts = findConflicts(allergies, todo.map((x) => x.med));
    if (conflicts.length && !override) return { conflicts, done: false };
    if (conflicts.length && (!override_reason || override_reason.trim().length < 3)) {
      throw new HttpError(422, 'Enter the reason for dispensing despite the allergy warning');
    }

    // consistent batch lock order across concurrent dispensings
    todo.sort((a, b) => a.item.medication_id - b.item.medication_id || a.item.id - b.item.id);

    const results = [];
    for (const { item, qty, med } of todo) {
      const [batches] = await conn.query(
        `SELECT id, batch_no, expiry_date, quantity_available FROM medication_batches
         WHERE medication_id = ? AND expiry_date >= CURDATE() AND quantity_available > 0
         ORDER BY expiry_date, id FOR UPDATE`, [item.medication_id]
      );
      const available = batches.reduce((s, b) => s + b.quantity_available, 0);
      if (available < qty) {
        throw new HttpError(409, `Not enough valid stock for ${label(med)}: requested ${qty}, available ${available}`);
      }

      let need = qty;
      const used = [];
      for (const b of batches) {
        if (need === 0) break;
        const take = Math.min(need, b.quantity_available);
        await conn.query(
          'INSERT INTO dispensing (prescription_item_id, batch_id, quantity, dispensed_by) VALUES (?,?,?,?)',
          [item.id, b.id, take, user.id]
        );
        await conn.query(
          'UPDATE medication_batches SET quantity_available = quantity_available - ? WHERE id = ? AND quantity_available >= ?',
          [take, b.id, take]
        );
        used.push({ batch_no: b.batch_no, expiry_date: b.expiry_date, quantity: take });
        need -= take;
      }
      await conn.query('UPDATE prescription_items SET quantity_dispensed = quantity_dispensed + ? WHERE id = ?', [qty, item.id]);
      results.push({ item_id: item.id, medication: label(med), controlled: !!med.is_controlled, quantity: qty, batches: used });
    }

    const [[{ rem }]] = await conn.query(
      'SELECT COALESCE(SUM(quantity - quantity_dispensed), 0) AS rem FROM prescription_items WHERE prescription_id = ?', [id]
    );
    const status = Number(rem) === 0 ? 'dispensed' : 'partially_dispensed';
    await conn.query('UPDATE prescriptions SET status = ? WHERE id = ?', [status, id]);

    return {
      done: true, status, items: results,
      overridden: conflicts.length > 0, conflicts, override_reason: conflicts.length ? override_reason.trim() : undefined,
    };
  });
}

module.exports = {
  listStock, listBatches, receive, adjust, createMedication, updateMedication,
  listPrescriptions, prescriptionDetail, dispense,
};