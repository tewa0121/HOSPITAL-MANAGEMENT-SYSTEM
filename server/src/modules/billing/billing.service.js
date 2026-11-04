const crypto = require('crypto');
const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');
const withTransaction = require('../../utils/transaction');
const { withBedDays } = require('../../utils/bedDays');

const NAME = "CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name)";
const UNBILLED = `e.status <> 'cancelled' AND e.encounter_type IN ('opd','emergency')
  AND e.started_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.encounter_id = e.id AND i.status <> 'cancelled')`;

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const compactDate = () => todayStr().replace(/-/g, '');
const tmp = () => `T${crypto.randomBytes(8).toString('hex')}`;
const orNull = (v) => {
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
};

// All money is calculated in whole cents to avoid floating point errors
const cents = (v) => Math.round(Number(v || 0) * 100);
const money = (c) => c / 100;
const fmt = (c) => (c / 100).toFixed(2);

const numbered = (prefix, id) => `${prefix}-${compactDate()}-${String(id).padStart(6, '0')}`;

const shape = (r) => ({
  ...r,
  subtotal: Number(r.subtotal), discount: Number(r.discount),
  total: Number(r.total), amount_paid: Number(r.amount_paid),
  balance: money(cents(r.total) - cents(r.amount_paid)),
});

// ---------- helpers ----------
async function lockInvoice(conn, id) {
  const [[inv]] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [id]);
  if (!inv) throw new HttpError(404, 'Invoice not found');
  return inv;
}
const assertOpen = (inv) => {
  if (inv.status === 'cancelled') throw new HttpError(400, 'This invoice is cancelled');
};

function insertItem(conn, invoiceId, it) {
  return conn.query(
    `INSERT INTO invoice_items (invoice_id, service_id, description, quantity, unit_price, line_total, reference_type, reference_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [invoiceId, it.service_id || null, String(it.description).slice(0, 200), it.quantity, it.unit_price,
     money(cents(it.unit_price) * it.quantity), it.reference_type, it.reference_id || null]
  );
}

// Recalculates totals and status from the items and payments. Always the last step of a change.
async function recalc(conn, id) {
  const [[inv]] = await conn.query('SELECT discount, amount_paid FROM invoices WHERE id = ?', [id]);
  const [[{ sub }]] = await conn.query('SELECT COALESCE(SUM(line_total), 0) AS sub FROM invoice_items WHERE invoice_id = ?', [id]);
  const subC = cents(sub);
  const discC = Math.min(cents(inv.discount), subC);
  const totC = subC - discC;
  const paidC = cents(inv.amount_paid);
  if (totC < paidC) {
    throw new HttpError(409, `The invoice total (ETB ${fmt(totC)}) cannot be lower than the amount already paid (ETB ${fmt(paidC)}). Refund the difference first.`);
  }
  const status = paidC >= totC ? 'paid' : paidC > 0 ? 'partial' : 'unpaid';
  await conn.query(
    'UPDATE invoices SET subtotal = ?, discount = ?, total = ?, status = ? WHERE id = ?',
    [money(subC), money(discC), money(totC), status, id]
  );
  return { subtotal: money(subC), discount: money(discC), total: money(totC), status };
}

// What the visit should be billed for right now
async function collectBillable(conn, encId) {
  const [[enc]] = await conn.query(
    `SELECT e.id, e.encounter_type, d.name AS dept
     FROM encounters e
     LEFT JOIN users u ON u.id = e.doctor_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE e.id = ?`, [encId]
  );
  if (!enc) throw new HttpError(404, 'Visit not found');

  let code = 'CONS-GEN';
  if (enc.encounter_type === 'emergency') code = 'CONS-EMG';
  else if (enc.dept && enc.dept !== 'General OPD') code = 'CONS-SPE';

  const [[cons]] = await conn.query('SELECT id, name, price FROM service_catalog WHERE code = ? AND is_active = 1', [code]);
  if (!cons) throw new HttpError(500, `Consultation tariff ${code} is missing in the service catalog`);

  const items = [{
    reference_type: 'consultation', reference_id: encId, service_id: cons.id,
    description: cons.name, quantity: 1, unit_price: cons.price,
  }];

  const [labs] = await conn.query(
    `SELECT lo.id, t.name, t.service_id, COALESCE(s.price, 0) AS price
     FROM lab_orders lo
     JOIN lab_tests t ON t.id = lo.test_id
     LEFT JOIN service_catalog s ON s.id = t.service_id
     WHERE lo.encounter_id = ? AND lo.status NOT IN ('cancelled','rejected') ORDER BY lo.id`, [encId]
  );
  labs.forEach((l) => items.push({
    reference_type: 'lab_order', reference_id: l.id, service_id: l.service_id,
    description: l.name, quantity: 1, unit_price: l.price,
  }));

  const [rx] = await conn.query(
    `SELECT pi.id, pi.quantity_dispensed AS qty, m.generic_name, m.strength, m.form, m.unit_price
     FROM prescription_items pi
     JOIN prescriptions p ON p.id = pi.prescription_id
     JOIN medications m ON m.id = pi.medication_id
     WHERE p.encounter_id = ? AND pi.quantity_dispensed > 0 ORDER BY pi.id`, [encId]
  );
  rx.forEach((r) => items.push({
    reference_type: 'prescription', reference_id: r.id, service_id: null,
    description: `${[r.generic_name, r.strength].filter(Boolean).join(' ')} (${r.form})`,
    quantity: r.qty, unit_price: r.unit_price,
  }));
  return items;
}

// ---------- queues and lists ----------
async function unbilled(f) {
  const where = [UNBILLED];
  const params = [];
  const q = (f.search || '').trim();
  if (q) { where.push(`(p.mrn LIKE ? OR ${NAME} LIKE ?)`); params.push(`%${q}%`, `%${q}%`); }

  const [rows] = await pool.query(
    `SELECT e.id, e.encounter_type, e.status, e.started_at, e.patient_id,
            p.mrn, ${NAME} AS patient_name, u.full_name AS doctor_name, d.name AS department,
            (SELECT COUNT(*) FROM lab_orders lo WHERE lo.encounter_id = e.id AND lo.status NOT IN ('cancelled','rejected')) AS lab_count,
            (SELECT COUNT(*) FROM prescription_items pi JOIN prescriptions rx ON rx.id = pi.prescription_id
              WHERE rx.encounter_id = e.id AND pi.quantity_dispensed > 0) AS rx_count
     FROM encounters e
     JOIN patients p ON p.id = e.patient_id
     LEFT JOIN users u ON u.id = e.doctor_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE ${where.join(' AND ')}
     ORDER BY e.started_at DESC LIMIT 200`, params
  );
  return rows;
}

async function list(f) {
  const status = ['open', 'unpaid', 'partial', 'paid', 'cancelled', 'all'].includes(f.status) ? f.status : 'open';
  const page = Math.max(Number(f.page) || 1, 1);
  const limit = Math.min(Math.max(Number(f.limit) || 10, 1), 100);
  const q = (f.search || '').trim();

  const where = [];
  const params = [];
  if (status === 'open') where.push("i.status IN ('unpaid','partial')");
  else if (status !== 'all') { where.push('i.status = ?'); params.push(status); }

  // a search looks through all dates; otherwise closed lists are shown per day
  if (status !== 'open' && !q) {
    where.push('DATE(i.created_at) = ?');
    params.push(/^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : todayStr());
  }
  if (q) {
    where.push(`(i.invoice_no LIKE ? OR p.mrn LIKE ? OR ${NAME} LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM invoices i JOIN patients p ON p.id = i.patient_id ${clause}`, params
  );
  const [rows] = await pool.query(
    `SELECT i.id, i.invoice_no, i.patient_id, i.encounter_id, i.subtotal, i.discount, i.total, i.amount_paid,
            i.status, i.created_at, p.mrn, ${NAME} AS patient_name, u.full_name AS created_by_name
     FROM invoices i
     JOIN patients p ON p.id = i.patient_id
     LEFT JOIN users u ON u.id = i.created_by
     ${clause}
     ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { items: rows.map(shape), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function detail(id) {
  const [[inv]] = await pool.query(
    `SELECT i.*, p.mrn, p.phone AS patient_phone, ${NAME} AS patient_name,
            u.full_name AS created_by_name, ap.full_name AS discount_approved_by_name
     FROM invoices i
     JOIN patients p ON p.id = i.patient_id
     LEFT JOIN users u ON u.id = i.created_by
     LEFT JOIN users ap ON ap.id = i.discount_approved_by
     WHERE i.id = ?`, [id]
  );
  if (!inv) throw new HttpError(404, 'Invoice not found');

  const [items] = await pool.query(
    `SELECT id, service_id, description, quantity, unit_price, line_total, reference_type, reference_id
     FROM invoice_items WHERE invoice_id = ?
     ORDER BY FIELD(reference_type, 'consultation','lab_order','prescription','other'), id`, [id]
  );
  const [payments] = await pool.query(
    `SELECT pay.id, pay.receipt_no, pay.amount, pay.method, pay.reference, pay.paid_at, u.full_name AS received_by_name
     FROM payments pay JOIN users u ON u.id = pay.received_by
     WHERE pay.invoice_id = ? ORDER BY pay.id`, [id]
  );
  return {
    ...shape(inv),
    items: items.map((i) => ({ ...i, unit_price: Number(i.unit_price), line_total: Number(i.line_total) })),
    payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
  };
}

async function summary(user) {
  // a cashier only sees their own collection; the admin (who can refund) sees everything
  const all = user.permissions.includes('billing.refund');
  const own = all ? '' : ' AND received_by = ?';
  const params = all ? [] : [user.id];

  const [methods] = await pool.query(
    `SELECT method,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS collected,
            COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS refunded
     FROM payments WHERE DATE(paid_at) = CURDATE()${own} GROUP BY method`, params
  );
  const [[out]] = await pool.query(
    "SELECT COUNT(*) AS n, COALESCE(SUM(total - amount_paid), 0) AS amount FROM invoices WHERE status IN ('unpaid','partial')"
  );
  const [[unb]] = await pool.query(`SELECT COUNT(*) AS n FROM encounters e WHERE ${UNBILLED}`);

  const rows = methods.map((m) => ({ method: m.method, collected: Number(m.collected), refunded: Number(m.refunded) }));
  const collected = rows.reduce((s, r) => s + cents(r.collected), 0);
  const refunded = rows.reduce((s, r) => s + cents(r.refunded), 0);
  return {
    scope: all ? 'all' : 'mine', methods: rows,
    collected: money(collected), refunded: money(refunded), net: money(collected - refunded),
    outstanding: { count: out.n, amount: Number(out.amount) },
    unbilled: unb.n,
  };
}

async function services() {
  const [rows] = await pool.query(
    `SELECT id, code, name, name_am, category, price FROM service_catalog
     WHERE is_active = 1 AND category NOT IN ('laboratory','pharmacy') ORDER BY category, name`
  );
  return rows.map((r) => ({ ...r, price: Number(r.price) }));
}

// ---------- invoice actions ----------
async function createForEncounter(encounterId, user) {
  return withTransaction(async (conn) => {
    const [[enc]] = await conn.query('SELECT id, patient_id, status FROM encounters WHERE id = ? FOR UPDATE', [encounterId]);
    if (!enc) throw new HttpError(404, 'Visit not found');
    if (enc.status === 'cancelled') throw new HttpError(400, 'A cancelled visit cannot be billed');

    const [dup] = await conn.query("SELECT invoice_no FROM invoices WHERE encounter_id = ? AND status <> 'cancelled' LIMIT 1", [encounterId]);
    if (dup.length) throw new HttpError(409, `This visit already has invoice ${dup[0].invoice_no}`);

    const [r] = await conn.query(
      'INSERT INTO invoices (invoice_no, patient_id, encounter_id, created_by) VALUES (?,?,?,?)',
      [tmp(), enc.patient_id, encounterId, user.id]
    );
    const invoice_no = numbered('INV', r.insertId);
    await conn.query('UPDATE invoices SET invoice_no = ? WHERE id = ?', [invoice_no, r.insertId]);

    for (const it of await collectBillable(conn, encounterId)) await insertItem(conn, r.insertId, it);
    const t = await recalc(conn, r.insertId);
    return { id: r.insertId, invoice_no, total: t.total };
  });
}

async function syncItems(id) {
  return withTransaction(async (conn) => {
    const [[pre]] = await conn.query('SELECT encounter_id, admission_id FROM invoices WHERE id = ?', [id]);
    if (!pre) throw new HttpError(404, 'Invoice not found');
    if (!pre.encounter_id && !pre.admission_id) throw new HttpError(400, 'This invoice is not linked to a visit or an admission');
    // lock order: visit (or admission) first, then invoice
    if (pre.encounter_id) await conn.query('SELECT id FROM encounters WHERE id = ? FOR UPDATE', [pre.encounter_id]);
    else await conn.query('SELECT id FROM admissions WHERE id = ? FOR UPDATE', [pre.admission_id]);
    const inv = await lockInvoice(conn, id);
    assertOpen(inv);

    const desired = inv.encounter_id
      ? await collectBillable(conn, inv.encounter_id)
      : await collectAdmissionBillable(conn, inv.admission_id);
    const [existing] = await conn.query(
      "SELECT * FROM invoice_items WHERE invoice_id = ? AND reference_type IN ('consultation','lab_order','prescription','admission') FOR UPDATE", [id]
    );
    const key = (t, rid) => `${t}:${rid}`;
    const have = new Map(existing.map((i) => [key(i.reference_type, i.reference_id), i]));
    const want = new Set(desired.map((d) => key(d.reference_type, d.reference_id)));

    let added = 0; let updated = 0; let removed = 0;
    for (const d of desired) {
      const cur = have.get(key(d.reference_type, d.reference_id));
      if (!cur) { await insertItem(conn, id, d); added++; }
      else if (cur.quantity !== d.quantity) {
        // only the quantity follows the clinical record; the price stays as invoiced
        await conn.query('UPDATE invoice_items SET quantity = ?, line_total = ? WHERE id = ?',
          [d.quantity, money(cents(cur.unit_price) * d.quantity), cur.id]);
        updated++;
      }
    }
    for (const i of existing) {
      if (!want.has(key(i.reference_type, i.reference_id))) {
        await conn.query('DELETE FROM invoice_items WHERE id = ?', [i.id]);
        removed++;
      }
    }
    await recalc(conn, id);
    return { added, updated, removed };
  });
}

async function addItem(id, { service_id, quantity }) {
  return withTransaction(async (conn) => {
    const inv = await lockInvoice(conn, id);
    assertOpen(inv);
    const [[s]] = await conn.query(
      "SELECT id, name, price, category FROM service_catalog WHERE id = ? AND is_active = 1", [service_id]
    );
    if (!s) throw new HttpError(404, 'Service not found');
    if (['laboratory', 'pharmacy'].includes(s.category)) {
      throw new HttpError(400, 'Lab tests and medication are billed automatically from the visit');
    }
    await insertItem(conn, id, {
      reference_type: 'other', reference_id: null, service_id: s.id,
      description: s.name, quantity: Number(quantity), unit_price: s.price,
    });
    await recalc(conn, id);
    return { service: s.name, quantity: Number(quantity), unit_price: Number(s.price) };
  });
}

async function removeItem(id, itemId) {
  return withTransaction(async (conn) => {
    const inv = await lockInvoice(conn, id);
    assertOpen(inv);
    const [[item]] = await conn.query('SELECT * FROM invoice_items WHERE id = ? AND invoice_id = ? FOR UPDATE', [itemId, id]);
    if (!item) throw new HttpError(404, 'Item not found');
    if (item.reference_type !== 'other') {
      throw new HttpError(400, 'Items from the visit cannot be removed by hand. They follow the clinical record (use Sync).');
    }
    await conn.query('DELETE FROM invoice_items WHERE id = ?', [itemId]);
    await recalc(conn, id);
    return { description: item.description, line_total: Number(item.line_total) };
  });
}

async function pay(id, d, user) {
  return withTransaction(async (conn) => {
    const inv = await lockInvoice(conn, id);
    assertOpen(inv);

    const balC = cents(inv.total) - cents(inv.amount_paid);
    if (balC <= 0) throw new HttpError(400, 'This invoice is already fully paid');
    const amtC = cents(d.amount);
    if (amtC <= 0) throw new HttpError(422, 'Enter a valid amount');
    if (amtC > balC) throw new HttpError(400, `The amount is higher than the balance (ETB ${fmt(balC)})`);

    const ref = orNull(d.reference);
    if (['telebirr', 'cbe_birr', 'bank_transfer'].includes(d.method) && !ref) {
      throw new HttpError(422, 'Enter the transaction reference number');
    }
    if (ref) {
      const [used] = await conn.query('SELECT receipt_no FROM payments WHERE method = ? AND reference = ? AND amount > 0 LIMIT 1', [d.method, ref]);
      if (used.length) throw new HttpError(409, `This transaction reference was already used (receipt ${used[0].receipt_no})`);
    }
    const [recent] = await conn.query(
      `SELECT receipt_no FROM payments WHERE invoice_id = ? AND amount = ? AND method = ? AND received_by = ?
         AND paid_at >= DATE_SUB(NOW(), INTERVAL 15 SECOND) LIMIT 1`,
      [id, money(amtC), d.method, user.id]
    );
    if (recent.length) {
      throw new HttpError(409, `An identical payment was just recorded (receipt ${recent[0].receipt_no}). If this is a separate payment, wait a few seconds and try again.`);
    }

    const [r] = await conn.query(
      'INSERT INTO payments (receipt_no, invoice_id, amount, method, reference, received_by) VALUES (?,?,?,?,?,?)',
      [tmp(), id, money(amtC), d.method, ref, user.id]
    );
    const receipt_no = numbered('RC', r.insertId);
    await conn.query('UPDATE payments SET receipt_no = ? WHERE id = ?', [receipt_no, r.insertId]);
    await conn.query('UPDATE invoices SET amount_paid = amount_paid + ? WHERE id = ?', [money(amtC), id]);
    const t = await recalc(conn, id);
    return {
      payment_id: r.insertId, receipt_no, invoice_no: inv.invoice_no, amount: money(amtC),
      method: d.method, reference: ref, status: t.status, balance: money(cents(t.total) - (cents(inv.amount_paid) + amtC)),
    };
  });
}

async function refund(id, d, user) {
  return withTransaction(async (conn) => {
    const inv = await lockInvoice(conn, id);
    assertOpen(inv);
    const amtC = cents(d.amount);
    const paidC = cents(inv.amount_paid);
    if (paidC <= 0) throw new HttpError(400, 'Nothing has been paid on this invoice');
    if (amtC <= 0) throw new HttpError(422, 'Enter a valid amount');
    if (amtC > paidC) throw new HttpError(400, `You cannot refund more than has been paid (ETB ${fmt(paidC)})`);

    // a refund is a NEW negative payment, existing records are never changed
    const [r] = await conn.query(
      'INSERT INTO payments (receipt_no, invoice_id, amount, method, reference, received_by) VALUES (?,?,?,?,?,?)',
      [tmp(), id, -money(amtC), d.method, `Refund: ${d.reason.trim()}`.slice(0, 80), user.id]
    );
    const receipt_no = numbered('RF', r.insertId);
    await conn.query('UPDATE payments SET receipt_no = ? WHERE id = ?', [receipt_no, r.insertId]);
    await conn.query('UPDATE invoices SET amount_paid = amount_paid - ? WHERE id = ?', [money(amtC), id]);
    const t = await recalc(conn, id);
    return { payment_id: r.insertId, receipt_no, invoice_no: inv.invoice_no, amount: money(amtC), method: d.method, reason: d.reason.trim(), status: t.status };
  });
}

async function setDiscount(id, d, user) {
  return withTransaction(async (conn) => {
    const inv = await lockInvoice(conn, id);
    assertOpen(inv);
    const subC = cents(inv.subtotal);
    const paidC = cents(inv.amount_paid);
    const discC = d.type === 'percent' ? Math.round((subC * Number(d.value)) / 100) : cents(d.value);

    if (discC > subC) throw new HttpError(422, 'The discount cannot be higher than the invoice subtotal');
    if (subC - discC < paidC) {
      throw new HttpError(409, `This discount would make the total lower than the amount already paid (ETB ${fmt(paidC)})`);
    }
    await conn.query(
      'UPDATE invoices SET discount = ?, discount_approved_by = ? WHERE id = ?',
      [money(discC), discC > 0 ? user.id : null, id]
    );
    const t = await recalc(conn, id);
    return {
      invoice_no: inv.invoice_no, type: d.type, value: Number(d.value),
      before: Number(inv.discount), after: money(discC), total: t.total, reason: d.reason.trim(),
    };
  });
}

async function cancel(id, reason) {
  return withTransaction(async (conn) => {
    const inv = await lockInvoice(conn, id);
    assertOpen(inv);
    if (cents(inv.amount_paid) > 0) {
      throw new HttpError(409, 'Payments exist on this invoice. Refund them first, then cancel.');
    }
    await conn.query("UPDATE invoices SET status = 'cancelled' WHERE id = ?", [id]);
    return { invoice_no: inv.invoice_no, total: Number(inv.total), reason: reason.trim() };
  });
}

// Bed-days for an admission, one item per bed assignment (price = the ward rate at that time)
async function collectAdmissionBillable(conn, admissionId) {
  const [rows] = await conn.query(
    `SELECT ba.id, ba.released_at, b.bed_number, w.name AS ward_name, w.daily_rate,
            TIMESTAMPDIFF(MINUTE, ba.assigned_at, COALESCE(ba.released_at, NOW())) AS minutes
     FROM bed_assignments ba
     JOIN beds b ON b.id = ba.bed_id
     JOIN wards w ON w.id = b.ward_id
     WHERE ba.admission_id = ? ORDER BY ba.id`, [admissionId]
  );
  return withBedDays(rows).filter((r) => r.days > 0).map((r) => ({
    reference_type: 'admission',
    reference_id: r.id,
    service_id: null,
    description: `Bed ${r.bed_number} - ${r.ward_name} (per day)`,
    quantity: r.days,
    unit_price: r.daily_rate,
  }));
}

async function createForAdmission(admissionId, user) {
  return withTransaction(async (conn) => {
    const [[adm]] = await conn.query('SELECT id, patient_id FROM admissions WHERE id = ? FOR UPDATE', [admissionId]);
    if (!adm) throw new HttpError(404, 'Admission not found');
    const [dup] = await conn.query("SELECT invoice_no FROM invoices WHERE admission_id = ? AND status <> 'cancelled' LIMIT 1", [admissionId]);
    if (dup.length) throw new HttpError(409, `This admission already has invoice ${dup[0].invoice_no}`);

    const [r] = await conn.query(
      'INSERT INTO invoices (invoice_no, patient_id, admission_id, created_by) VALUES (?,?,?,?)',
      [tmp(), adm.patient_id, admissionId, user.id]
    );
    const invoice_no = numbered('INV', r.insertId);
    await conn.query('UPDATE invoices SET invoice_no = ? WHERE id = ?', [invoice_no, r.insertId]);
    for (const it of await collectAdmissionBillable(conn, admissionId)) await insertItem(conn, r.insertId, it);
    const t = await recalc(conn, r.insertId);
    return { id: r.insertId, invoice_no, total: t.total };
  });
}

async function unbilledAdmissions(f) {
  const where = [
    "a.status IN ('admitted','discharged')",
    'a.admitted_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)',
    "NOT EXISTS (SELECT 1 FROM invoices i WHERE i.admission_id = a.id AND i.status <> 'cancelled')",
  ];
  const params = [];
  const q = (f.search || '').trim();
  if (q) { where.push(`(p.mrn LIKE ? OR ${NAME} LIKE ?)`); params.push(`%${q}%`, `%${q}%`); }
  const [rows] = await pool.query(
    `SELECT a.id, a.status, a.admitted_at, a.discharged_at, a.patient_id, p.mrn, ${NAME} AS patient_name,
            b.bed_number, w.name AS ward_name, w.name_am AS ward_name_am,
            TIMESTAMPDIFF(MINUTE, a.admitted_at, COALESCE(a.discharged_at, NOW())) AS minutes
     FROM admissions a
     JOIN patients p ON p.id = a.patient_id
     JOIN beds b ON b.id = a.bed_id
     JOIN wards w ON w.id = b.ward_id
     WHERE ${where.join(' AND ')} ORDER BY a.admitted_at DESC LIMIT 100`, params
  );
  return rows.map((r) => ({ ...r, days: Math.max(1, Math.ceil(Number(r.minutes) / 1440)) }));
}

module.exports = {
  unbilled, unbilledAdmissions, list, detail, summary, services, createForEncounter, createForAdmission, syncItems,
  addItem, removeItem, pay, refund, setDiscount, cancel,
};