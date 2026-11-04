require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// ---------- helpers ----------
let seed = 20261104; // fixed seed: the same data every time
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;

const NOW = new Date();
const pad = (n, w = 2) => String(n).padStart(w, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// no record is ever stamped in the future
const dt = (d) => { const x = d > NOW ? NOW : d; return `${ymd(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}:00`; };
const tm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const addMin = (d, m) => new Date(d.getTime() + m * 60000);
const dayAt = (daysAgo, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d; };
const ago = (hours) => new Date(NOW.getTime() - hours * 3600000);
const recent = (minAgo) => new Date(Math.max(dayAt(0, 0, 1).getTime(), NOW.getTime() - minAgo * 60000));
const compact = (d) => ymd(d).replace(/-/g, '');
const cents = (v) => Math.round(Number(v) * 100);
const money = (v) => v / 100;
let tmpN = 0;
const tmp = () => `T${(++tmpN).toString(36)}${Date.now().toString(36)}`;
let refN = 0;

// ---------- reference data ----------
const MALE = ['Abebe', 'Dawit', 'Yonas', 'Getachew', 'Solomon', 'Bereket', 'Mulugeta', 'Fikadu', 'Henok', 'Tamirat', 'Elias', 'Samuel'];
const FEMALE = ['Almaz', 'Tigist', 'Meseret', 'Selamawit', 'Hanna', 'Mekdes', 'Birtukan', 'Aster', 'Rahel', 'Zewditu', 'Marta', 'Eden'];
const FATHER = ['Bekele', 'Tesfaye', 'Alemu', 'Wolde', 'Haile', 'Girma', 'Assefa', 'Mengistu', 'Kassa', 'Desta', 'Tola', 'Gebre'];
const AGES = [34, 28, 5, 45, 62, 19, 31, 9, 52, 38, 24, 67, 41, 3, 29, 36, 48, 22, 57, 33, 27, 44, 16, 71, 39, 26, 53, 30, 8, 42];
const WOREDA = ['Banja', 'Ankasha', 'Guagusa', 'Fagita'];
const OCC = ['Farmer', 'Teacher', 'Merchant', 'Student', 'Driver', 'Housewife', 'Civil servant', 'Daily laborer'];
const BLOOD = ['A+', 'B+', 'O+', 'O-', 'AB+', 'unknown', 'O+', 'A-'];
const METHODS = ['cash', 'cash', 'cash', 'telebirr', 'telebirr', 'cbe_birr', 'bank_transfer'];
const REF_PREFIX = { telebirr: 'TB', cbe_birr: 'CB', bank_transfer: 'BT' };

const CONDS = [
  { dx: ['B54', 'Malaria, unspecified'], cc: 'Fever, chills and headache for 3 days', labs: ['MAL', 'CBC'], malaria: true, fever: true,
    meds: [['Artemether/Lumefantrine', '4 tablets', 'BD - Twice daily', 3, 24], ['Paracetamol', '1 tablet', 'TDS - Three times daily', 3, 9]] },
  { dx: ['A09', 'Diarrhoea and gastroenteritis'], cc: 'Watery diarrhoea and vomiting', labs: ['STO'],
    meds: [['Oral Rehydration Salts', '1 sachet', 'TDS - Three times daily', 3, 9], ['Metronidazole', '1 tablet', 'TDS - Three times daily', 5, 15]] },
  { dx: ['J06.9', 'Acute upper respiratory infection'], cc: 'Cough and sore throat', labs: [], fever: true,
    meds: [['Paracetamol', '1 tablet', 'TDS - Three times daily', 3, 9], ['Amoxicillin', '1 capsule', 'TDS - Three times daily', 5, 15]] },
  { dx: ['I10', 'Essential hypertension'], cc: 'Headache and dizziness', labs: ['CRE'], bp: true,
    meds: [['Amlodipine', '1 tablet', 'OD - Once daily', 30, 30]] },
  { dx: ['E11.9', 'Type 2 diabetes mellitus'], cc: 'Increased thirst and frequent urination', labs: ['GLU'], diabetic: true,
    meds: [['Metformin', '1 tablet', 'BD - Twice daily', 15, 30]] },
  { dx: ['N39.0', 'Urinary tract infection'], cc: 'Burning urination', labs: ['URI'],
    meds: [['Amoxicillin', '1 capsule', 'TDS - Three times daily', 7, 21], ['Paracetamol', '1 tablet', 'TDS - Three times daily', 3, 9]] },
  { dx: ['R50.9', 'Fever, unspecified'], cc: 'Fever for 2 days', labs: ['CBC'], fever: true,
    meds: [['Paracetamol', '1 tablet', 'TDS - Three times daily', 3, 9]] },
];

let c; // connection
let U; let MED; let LAB; let SERV; let BED; let WARD; let PREFIX;
const slots = {};
let refundDone = false;

const slotOf = (doc, daysAgo) => { const key = `${doc.id}-${daysAgo}`; slots[key] = (slots[key] ?? -1) + 1; return slots[key]; };

// ---------- building blocks ----------
async function addPatient(i, createdAt) {
  const male = i % 2 === 0;
  const age = AGES[i];
  const dob = new Date(NOW.getFullYear() - age, NOW.getMonth() - int(1, 10), 1 + int(0, 27));
  const first = (male ? MALE : FEMALE)[Math.floor(i / 2) % 12];
  const father = FATHER[(i * 7 + 3 + Math.floor(i / 12)) % 12];
  const grand = FATHER[(i * 5 + 1) % 12];
  const [r] = await c.query(
    `INSERT INTO patients (mrn, first_name, father_name, grandfather_name, gender, date_of_birth, phone, region, zone, woreda,
       kebele, house_number, blood_group, marital_status, occupation, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [tmp(), first, father, grand, male ? 'male' : 'female', ymd(dob), `+2519${String(11000000 + i * 93713).slice(0, 8)}`,
      'Amhara', 'Awi', pick(WOREDA), `Kebele 0${int(1, 6)}`, `H-${int(10, 480)}`, BLOOD[i % 8],
      age < 18 ? 'single' : pick(['single', 'married', 'married', 'divorced', 'widowed']),
      age < 7 ? null : age < 18 ? 'Student' : pick(OCC), U.reception1.id, dt(createdAt)]
  );
  await c.query('UPDATE patients SET mrn = ? WHERE id = ?', [`${PREFIX}-${NOW.getFullYear()}-${pad(r.insertId, 6)}`, r.insertId]);
  await c.query('INSERT INTO patient_contacts (patient_id, full_name, relationship, phone) VALUES (?,?,?,?)',
    [r.insertId, `${pick(MALE.concat(FEMALE))} ${pick(FATHER)}`, age < 18 ? 'Parent' : pick(['Spouse', 'Sibling', 'Child', 'Parent']),
      `+2519${String(22000000 + i * 77711).slice(0, 8)}`]);
  return { id: r.insertId, i, male, age, name: `${first} ${father}` };
}

async function appt({ p, doc, start, type = 'scheduled', status, queue = null, reason = null, createdAt }) {
  const [a] = await c.query(
    `INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, start_time, end_time, type, status,
       queue_number, reason, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.id, doc.id, doc.department_id, ymd(start), tm(start), tm(addMin(start, 20)), type, status, queue, reason,
      U.reception1.id, dt(createdAt || addMin(start, -30))]
  );
  return a.insertId;
}

// FEFO: earliest valid expiry first, never an expired batch
async function dispense(itemId, medId, qty, when) {
  const [batches] = await c.query(
    `SELECT id, quantity_available FROM medication_batches
     WHERE medication_id = ? AND expiry_date >= ? AND quantity_available > 0 ORDER BY expiry_date, id`, [medId, ymd(when)]
  );
  let need = qty;
  const plan = [];
  for (const b of batches) {
    if (!need) break;
    const take = Math.min(need, b.quantity_available);
    plan.push([b.id, take]);
    need -= take;
  }
  if (need > 0) return 0;
  for (const [batchId, take] of plan) {
    await c.query('INSERT INTO dispensing (prescription_item_id, batch_id, quantity, dispensed_by, dispensed_at) VALUES (?,?,?,?,?)',
      [itemId, batchId, take, U.pharma1.id, dt(when)]);
    await c.query('UPDATE medication_batches SET quantity_available = quantity_available - ? WHERE id = ?', [take, batchId]);
  }
  await c.query('UPDATE prescription_items SET quantity_dispensed = ? WHERE id = ?', [qty, itemId]);
  return qty;
}

function numericFlag(t, n) {
  const lo = t.ref_low === null ? null : Number(t.ref_low);
  const hi = t.ref_high === null ? null : Number(t.ref_high);
  let flag = 'normal';
  if (lo !== null && n < lo) flag = 'low';
  if (hi !== null && n > hi) flag = 'high';
  if ((lo !== null && lo > 0 && n < lo * 0.5) || (hi !== null && hi > 0 && n > hi * 2)) flag = 'critical';
  return flag;
}

function labResult(t, cond) {
  if (t.code === 'MAL') return cond.malaria ? { value: 'Positive', flag: 'high' } : { value: 'Negative', flag: 'normal' };
  if (t.code === 'STO') return chance(0.5) ? { value: 'Ascaris lumbricoides seen', flag: 'high' } : { value: 'No parasites seen', flag: 'normal' };
  if (t.code === 'URI') return chance(0.7) ? { value: 'Pus cells ++', flag: 'high' } : { value: 'Normal', flag: 'normal' };
  let n;
  if (t.code === 'CBC') n = chance(0.7) ? 4.5 + rnd() * 5.5 : 11.5 + rnd() * 6;
  else if (t.code === 'GLU') n = cond.diabetic ? 130 + rnd() * 90 : 75 + rnd() * 22;
  else n = chance(0.8) ? 0.7 + rnd() * 0.5 : 1.4 + rnd() * 0.8; // CRE
  const value = n.toFixed(t.code === 'CRE' ? 2 : 1);
  return { value, flag: numericFlag(t, Number(value)) };
}

async function makeInvoice({ patientId, encId = null, admId = null, items, createdAt, pay = 'none', method = 'cash', discount = false, payC }) {
  const subC = items.reduce((s, i) => s + cents(i.price) * i.qty, 0);
  const discC = discount ? Math.round(subC * 0.1) : 0;
  const totC = subC - discC;
  let paidC = pay === 'full' ? totC : pay === 'partial' ? (payC ?? Math.floor(totC / 2 / 100) * 100) : 0;
  if (pay !== 'none' && paidC <= 0) paidC = totC;
  const status = paidC >= totC ? 'paid' : paidC > 0 ? 'partial' : 'unpaid';

  const [inv] = await c.query(
    `INSERT INTO invoices (invoice_no, patient_id, encounter_id, admission_id, subtotal, discount, discount_approved_by, total,
       amount_paid, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [tmp(), patientId, encId, admId, money(subC), money(discC), discC > 0 ? U.admin.id : null, money(totC), money(paidC), status,
      U.cashier1.id, dt(createdAt)]
  );
  await c.query('UPDATE invoices SET invoice_no = ? WHERE id = ?', [`INV-${compact(createdAt > NOW ? NOW : createdAt)}-${pad(inv.insertId, 6)}`, inv.insertId]);
  for (const it of items) {
    await c.query(
      `INSERT INTO invoice_items (invoice_id, service_id, description, quantity, unit_price, line_total, reference_type, reference_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [inv.insertId, it.service_id || null, String(it.desc).slice(0, 200), it.qty, it.price, money(cents(it.price) * it.qty), it.type, it.ref || null]
    );
  }
  if (paidC > 0) {
    const paidAt = addMin(createdAt, 5);
    const [pay1] = await c.query(
      'INSERT INTO payments (receipt_no, invoice_id, amount, method, reference, received_by, paid_at) VALUES (?,?,?,?,?,?,?)',
      [tmp(), inv.insertId, money(paidC), method, REF_PREFIX[method] ? `${REF_PREFIX[method]}${70000000 + ++refN}` : null, U.cashier1.id, dt(paidAt)]
    );
    await c.query('UPDATE payments SET receipt_no = ? WHERE id = ?', [`RC-${compact(paidAt > NOW ? NOW : paidAt)}-${pad(pay1.insertId, 6)}`, pay1.insertId]);
  }
  return { id: inv.insertId, totC, paidC };
}

// a refund is a NEW negative payment, never an edit
async function refund(inv, amtC, when) {
  const [r] = await c.query(
    'INSERT INTO payments (receipt_no, invoice_id, amount, method, reference, received_by, paid_at) VALUES (?,?,?,?,?,?,?)',
    [tmp(), inv.id, -money(amtC), 'cash', 'Refund: Test not performed', U.admin.id, dt(when)]
  );
  await c.query('UPDATE payments SET receipt_no = ? WHERE id = ?', [`RF-${compact(when > NOW ? NOW : when)}-${pad(r.insertId, 6)}`, r.insertId]);
  await c.query("UPDATE invoices SET amount_paid = amount_paid - ?, status = 'partial' WHERE id = ?", [money(amtC), inv.id]);
}

// ---------- one OPD visit with everything that belongs to it ----------
async function visit(o) {
  const { p, doc, daysAgo = 0 } = o;
  const state = o.state || 'completed';
  const cond = o.cond || pick(CONDS);
  const type = o.type || (chance(0.25) ? 'walk_in' : 'scheduled');
  const k = slotOf(doc, daysAgo);
  const start = o.start || addMin(dayAt(daysAgo, 8, 0), k * 20);
  const apptStatus = { completed: 'completed', waiting: 'checked_in', triaged: 'checked_in', in_consultation: 'in_consultation', awaiting_results: 'in_consultation' }[state];
  const apptId = await appt({ p, doc, start, type, status: apptStatus, queue: k + 1, reason: cond.cc });

  const notes = state !== 'waiting' && state !== 'triaged';
  const [e] = await c.query(
    `INSERT INTO encounters (patient_id, appointment_id, doctor_id, encounter_type, status, chief_complaint, history_present_illness,
       examination, treatment_plan, started_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [p.id, apptId, doc.id, 'opd', state, notes ? cond.cc : null, notes ? `Symptoms began a few days ago. ${cond.cc}.` : null,
      notes ? 'Alert, no acute distress. Vital signs reviewed.' : null,
      state === 'completed' ? 'Medication as prescribed. Return if symptoms worsen.' : null, dt(start)]
  );

  if (state !== 'waiting') {
    const child = p.age < 15;
    const sys = cond.bp ? int(150, 178) : child ? int(90, 105) : int(105, 132);
    const dia = cond.bp ? int(95, 108) : child ? int(55, 68) : int(65, 84);
    await c.query(
      `INSERT INTO vital_signs (encounter_id, patient_id, temperature_c, pulse, respiratory_rate, bp_systolic, bp_diastolic, spo2,
         weight_kg, height_cm, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [e.insertId, p.id, (cond.fever ? 37.9 + rnd() * 1.8 : 36.4 + rnd() * 0.8).toFixed(1), int(68, 112), int(14, 22), sys, dia, int(95, 99),
        (child ? 3 + p.age * 2.5 : p.male ? 60 + rnd() * 25 : 50 + rnd() * 25).toFixed(1),
        (child ? 75 + p.age * 6 : p.male ? 160 + rnd() * 20 : 150 + rnd() * 20).toFixed(1), U.nurse1.id, dt(addMin(start, 8))]
    );
  }

  if (state === 'completed') {
    await c.query('INSERT INTO diagnoses (encounter_id, patient_id, icd10_code, description, type, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
      [e.insertId, p.id, cond.dx[0], cond.dx[1], 'primary', doc.id, dt(addMin(start, 20))]);
  }

  // laboratory
  const labSpecs = o.labs || (state === 'completed' ? cond.labs.map((code) => ({ code, status: 'verified' })) : []);
  const labRows = [];
  let lastLab = start;
  for (const [i, spec] of labSpecs.entries()) {
    const t = LAB[spec.code];
    const created = addMin(start, 10 + i);
    const collected = addMin(start, 25 + i);
    const resulted = addMin(start, 45 + i);
    const verified = addMin(start, 60 + i);
    const st = spec.status;
    const has = st !== 'ordered';
    const res = ['resulted', 'verified'].includes(st)
      ? (spec.value !== undefined ? { value: spec.value, flag: spec.flag } : labResult(t, cond)) : null;
    const [l] = await c.query(
      `INSERT INTO lab_orders (encounter_id, patient_id, test_id, ordered_by, priority, status, collected_by, collected_at, result_value,
         result_flag, resulted_by, resulted_at, verified_by, verified_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [e.insertId, p.id, t.id, doc.id, spec.priority || 'routine', st, has ? U.lab1.id : null, has ? dt(collected) : null,
        res ? res.value : null, res ? res.flag : null, res ? U.lab1.id : null, res ? dt(resulted) : null,
        st === 'verified' ? U.lab1.id : null, st === 'verified' ? dt(verified) : null, dt(created)]
    );
    if (has) await c.query('UPDATE lab_orders SET barcode = ? WHERE id = ?', [`L${compact(collected > NOW ? NOW : collected)}-${pad(l.insertId, 6)}`, l.insertId]);
    labRows.push({ id: l.insertId, t });
    if (st === 'verified') lastLab = verified;
  }

  // prescription and FEFO dispensing
  const rxSpec = o.rx === undefined ? (state === 'completed' ? { items: cond.meds } : null) : o.rx;
  const rxItems = [];
  if (rxSpec) {
    const created = addMin(start, 20);
    const [r] = await c.query('INSERT INTO prescriptions (encounter_id, patient_id, doctor_id, status, created_at) VALUES (?,?,?,?,?)',
      [e.insertId, p.id, doc.id, 'pending', dt(created)]);
    let total = 0; let given = 0;
    for (const [i, [name, dose, freq, days, qty]] of rxSpec.items.entries()) {
      const m = MED[name];
      const [ri] = await c.query(
        `INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity) VALUES (?,?,?,?,?,?)`,
        [r.insertId, m.id, dose, freq, days, qty]
      );
      const want = rxSpec.give ? rxSpec.give[i] : qty;
      const got = want > 0 ? await dispense(ri.insertId, m.id, want, addMin(created, 15)) : 0;
      rxItems.push({ id: ri.insertId, m, qty: got });
      total += qty; given += got;
    }
    const status = given === 0 ? 'pending' : given < total ? 'partially_dispensed' : 'dispensed';
    await c.query('UPDATE prescriptions SET status = ? WHERE id = ?', [status, r.insertId]);
  }

  // closing and billing
  if (state === 'completed') {
    const closed = addMin(labSpecs.length ? lastLab : addMin(start, 20), 10 + int(0, 10));
    await c.query('UPDATE encounters SET closed_at = ? WHERE id = ?', [dt(closed), e.insertId]);

    if (o.bill !== null) {
      let b = o.bill;
      if (!b) {
        const r = rnd();
        b = { pay: r < 0.78 ? 'full' : r < 0.9 ? 'partial' : 'none', method: pick(METHODS) };
        if (chance(0.07)) b.discount = true;
      }
      const cons = doc.dept === 'General OPD' ? SERV['CONS-GEN'] : SERV['CONS-SPE'];
      const items = [{ type: 'consultation', ref: e.insertId, service_id: cons.id, desc: cons.name, qty: 1, price: cons.price }];
      labRows.forEach((l) => items.push({ type: 'lab_order', ref: l.id, service_id: l.t.service_id, desc: l.t.name, qty: 1, price: Number(l.t.price || 0) }));
      rxItems.filter((x) => x.qty > 0).forEach((x) => items.push({
        type: 'prescription', ref: x.id, desc: `${[x.m.generic_name, x.m.strength].filter(Boolean).join(' ')} (${x.m.form})`,
        qty: x.qty, price: Number(x.m.unit_price),
      }));
      const inv = await makeInvoice({ patientId: p.id, encId: e.insertId, items, createdAt: addMin(closed, 3), ...b });
      if (!refundDone && daysAgo >= 1 && daysAgo <= 4 && b.pay === 'full' && inv.totC >= 10000 && chance(0.5)) {
        await refund(inv, 5000, addMin(closed, 40));
        refundDone = true;
      }
    }
  }
  return e.insertId;
}

// ---------- inpatient stays ----------
async function admission(o) {
  const last = o.stays[o.stays.length - 1];
  const [a] = await c.query(
    `INSERT INTO admissions (patient_id, bed_id, admitting_doctor_id, reason, status, admitted_at, discharged_at, discharged_by, discharge_summary)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [o.p.id, BED[last.bed], o.doc.id, o.reason, o.discharged ? 'discharged' : 'admitted', dt(o.stays[0].from),
      o.discharged ? dt(o.discharged) : null, o.discharged ? o.doc.id : null, o.summary || null]
  );
  const rows = [];
  for (const [i, s] of o.stays.entries()) {
    const to = s.to || (o.discharged ? o.discharged : null);
    const [r] = await c.query(
      'INSERT INTO bed_assignments (admission_id, bed_id, assigned_at, released_at, assigned_by, transfer_reason) VALUES (?,?,?,?,?,?)',
      [a.insertId, BED[s.bed], dt(s.from), to ? dt(to) : null, o.doc.id, i > 0 ? s.reason : null]
    );
    await c.query('UPDATE beds SET status = ? WHERE id = ?', [to ? s.after || 'cleaning' : 'occupied', BED[s.bed]]);
    rows.push({ id: r.insertId, bed: s.bed, minutes: to ? (to - s.from) / 60000 : null });
  }
  for (const n of o.notes || []) {
    await c.query('INSERT INTO admission_notes (admission_id, author_id, note_type, note, created_at) VALUES (?,?,?,?,?)',
      [a.insertId, n.type === 'progress' ? o.doc.id : U.nurse1.id, n.type, n.text, dt(n.at)]);
  }
  return { id: a.insertId, rows };
}

// ---------- main ----------
(async () => {
  c = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });

  const [[{ n }]] = await c.query('SELECT COUNT(*) AS n FROM patients');
  if (n > 0) {
    console.log('The database already has patients. Import reset_demo.sql first (phpMyAdmin > Import), then run this again.');
    await c.end();
    return;
  }

  await c.beginTransaction();
  try {
    const [users] = await c.query('SELECT u.id, u.username, u.department_id, d.name AS dept FROM users u LEFT JOIN departments d ON d.id = u.department_id');
    U = Object.fromEntries(users.map((u) => [u.username, u]));
    const missing = ['reception1', 'doctor1', 'doctor2', 'nurse1', 'lab1', 'pharma1', 'cashier1', 'admin'].filter((x) => !U[x]);
    if (missing.length) throw new Error(`Demo users missing: ${missing.join(', ')}. Run node database/seedUsers.js first.`);

    const [meds] = await c.query('SELECT id, generic_name, strength, form, unit_price FROM medications');
    MED = Object.fromEntries(meds.map((m) => [m.generic_name, m]));
    const [tests] = await c.query('SELECT t.id, t.code, t.name, t.ref_low, t.ref_high, t.service_id, s.price FROM lab_tests t LEFT JOIN service_catalog s ON s.id = t.service_id');
    LAB = Object.fromEntries(tests.map((t) => [t.code, t]));
    const [serv] = await c.query('SELECT id, code, name, price FROM service_catalog');
    SERV = Object.fromEntries(serv.map((s) => [s.code, s]));
    const [beds] = await c.query('SELECT id, bed_number FROM beds');
    BED = Object.fromEntries(beds.map((b) => [b.bed_number, b.id]));
    const [wards] = await c.query('SELECT code, name, daily_rate FROM wards');
    WARD = Object.fromEntries(wards.map((w) => [w.code, w]));
    const [[pf]] = await c.query("SELECT setting_value AS v FROM settings WHERE setting_key = 'mrn_prefix'");
    PREFIX = pf ? pf.v : 'HMS';

    // a small batch makes the low-stock alert appear in the demo
    await c.query("UPDATE medication_batches SET quantity_received = 40, quantity_available = 40 WHERE batch_no = 'CEF-2609'");

    // ----- 14 days of patients and visits (today is scripted below) -----
    const EXCLUDE = new Set([3]); // the penicillin-allergic patient only has today's visit
    const reg = [];
    let next = 0;
    for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
      const target = Math.min(30, Math.round(((14 - daysAgo) * 30) / 14));
      while (next < target) { reg.push(await addPatient(next, dayAt(daysAgo, 7, 30))); next++; }
      if (daysAgo === 0) break;

      const used = new Set();
      const free = () => {
        const pool = reg.filter((x) => !EXCLUDE.has(x.i) && !used.has(x.id));
        if (!pool.length) return null;
        const p = pick(pool);
        used.add(p.id);
        return p;
      };
      for (let j = int(3, 6); j > 0; j--) {
        const p = free();
        if (p) await visit({ p, doc: chance(0.6) ? U.doctor1 : U.doctor2, daysAgo });
      }
      if (daysAgo <= 10) {
        if (chance(0.3)) { const p = free(); const doc = pick([U.doctor1, U.doctor2]); if (p) await appt({ p, doc, start: addMin(dayAt(daysAgo, 8, 0), slotOf(doc, daysAgo) * 20), status: 'no_show' }); }
        if (chance(0.2)) { const p = free(); const doc = pick([U.doctor1, U.doctor2]); if (p) await appt({ p, doc, start: addMin(dayAt(daysAgo, 8, 0), slotOf(doc, daysAgo) * 20), status: 'cancelled' }); }
      }
    }

    // ----- allergies -----
    const allergies = [[3, 'Penicillin', 'Rash and difficulty breathing', 'severe'], [10, 'Sulfa drugs', 'Skin rash', 'moderate'],
      [6, 'Peanuts', 'Itching', 'mild'], [17, 'Ibuprofen', 'Stomach pain', 'moderate']];
    for (const [i, allergen, reaction, severity] of allergies) {
      await c.query('INSERT INTO allergies (patient_id, allergen, reaction, severity, recorded_by, created_at) VALUES (?,?,?,?,?,?)',
        [reg[i].id, allergen, reaction, severity, U.doctor1.id, dt(dayAt(2, 10, 0))]);
    }

    // ----- today: every queue in a different state -----
    const d1 = U.doctor1; const d2 = U.doctor2;
    await visit({ p: reg[25], doc: d1, state: 'completed', type: 'walk_in', start: recent(300), bill: { pay: 'full', method: 'cash' } });
    await visit({ p: reg[26], doc: d2, state: 'completed', type: 'walk_in', start: recent(240), bill: { pay: 'full', method: 'telebirr' } });
    // completed, partly dispensed, invoiced and paid: "Update from visit" later adds the rest
    await visit({ p: reg[24], doc: d1, state: 'completed', start: recent(180), cond: CONDS[1], rx: { items: CONDS[1].meds, give: [9, 5] }, bill: { pay: 'full', method: 'cash' } });
    // completed with a prescription waiting; Amoxicillin for a penicillin-allergic patient; not yet invoiced
    await visit({
      p: reg[3], doc: d2, state: 'completed', start: recent(150), cond: CONDS[2], bill: null,
      rx: { items: [['Amoxicillin', '1 capsule', 'TDS - Three times daily', 5, 15], ['Paracetamol', '1 tablet', 'TDS - Three times daily', 3, 9]], give: [0, 0] },
    });
    await visit({
      p: reg[23], doc: d1, state: 'awaiting_results', start: recent(90), cond: CONDS[4], rx: null,
      labs: [{ code: 'GLU', status: 'resulted', value: '320', flag: 'critical' }, { code: 'CBC', status: 'collected' }, { code: 'CRE', status: 'ordered', priority: 'urgent' }],
    });
    await visit({ p: reg[22], doc: d1, state: 'in_consultation', start: recent(60), cond: CONDS[2], rx: null });
    await visit({ p: reg[20], doc: d1, state: 'waiting', type: 'scheduled', start: recent(45), cond: CONDS[6] });
    await visit({ p: reg[21], doc: d2, state: 'triaged', start: recent(35), cond: CONDS[3] });
    // booked for later today
    for (const [pi, doc, h, m] of [[27, d1, 16, 0], [29, d1, 16, 20], [28, d2, 16, 0]]) {
      await appt({ p: reg[pi], doc, start: dayAt(0, h, m), status: 'scheduled', reason: 'Follow-up', createdAt: recent(600) });
    }

    // ----- booked appointments for the next 5 days -----
    for (let ahead = 1; ahead <= 5; ahead++) {
      const used = new Set();
      const counter = {};
      for (let j = int(2, 4); j > 0; j--) {
        const p = pick(reg.filter((x) => !EXCLUDE.has(x.i) && !used.has(x.id)));
        used.add(p.id);
        const doc = pick([d1, d2]);
        counter[doc.id] = (counter[doc.id] ?? -1) + 1;
        const base = dayAt(-ahead, 9, 0);
        await appt({ p, doc, start: addMin(base, counter[doc.id] * 20), status: 'scheduled', reason: 'Check-up', createdAt: ago(int(2, 40)) });
      }
    }

    // ----- inpatients -----
    await admission({ // admitted 4 days ago, moved to ICU 2 days ago
      p: reg[0], doc: d1, reason: 'Severe malaria with signs of organ involvement',
      stays: [{ bed: 'GM-01', from: ago(96), to: ago(50), after: 'available' }, { bed: 'ICU-01', from: ago(50), reason: 'Needs ICU monitoring' }],
      notes: [{ type: 'progress', at: ago(48), text: 'Transferred to ICU. IV artesunate started. Monitoring glucose and urine output.' },
        { type: 'nursing', at: ago(30), text: 'Temperature 38.4. IV line patent. Patient drinking small amounts.' },
        { type: 'progress', at: ago(6), text: 'Fever improving. Continue IV treatment, repeat blood film tomorrow.' }],
    });
    await admission({
      p: reg[1], doc: d2, reason: 'Pneumonia needing IV antibiotics', stays: [{ bed: 'GF-02', from: ago(26) }],
      notes: [{ type: 'progress', at: ago(25), text: 'Chest X-ray shows right lower lobe consolidation. Ceftriaxone started.' },
        { type: 'nursing', at: ago(8), text: 'SpO2 94% on room air. Cough productive.' }],
    });
    await admission({
      p: reg[2], doc: d1, reason: 'Severe dehydration with gastroenteritis', stays: [{ bed: 'PED-01', from: ago(4) }],
      notes: [{ type: 'nursing', at: ago(3), text: 'IV fluids running. Passed urine once.' }],
    });
    const dis1 = await admission({ // discharged 2 days ago, bed still waiting for cleaning, invoice partly paid
      p: reg[5], doc: d2, reason: 'Acute pyelonephritis', stays: [{ bed: 'GF-01', from: ago(120), after: 'cleaning' }], discharged: ago(48),
      summary: 'Acute pyelonephritis treated with IV antibiotics for 3 days. Afebrile for 24 hours. Discharged on oral antibiotics. Review in OPD in one week.',
    });
    await admission({ // discharged 6 days ago, not yet invoiced
      p: reg[4], doc: d1, reason: 'Hypertensive urgency', stays: [{ bed: 'GM-02', from: ago(200), after: 'available' }], discharged: ago(140),
      summary: 'Blood pressure controlled on oral medication. Discharged with advice on salt restriction and regular follow-up.',
    });
    const days = Math.max(1, Math.ceil(dis1.rows[0].minutes / 1440));
    await makeInvoice({
      patientId: reg[5].id, admId: dis1.id, createdAt: ago(47), pay: 'partial', payC: 50000, method: 'cash',
      items: [{ type: 'admission', ref: dis1.rows[0].id, desc: `Bed GF-01 - ${WARD.GF.name} (per day)`, qty: days, price: Number(WARD.GF.daily_rate) }],
    });

    await c.commit();

    const count = async (t) => (await c.query(`SELECT COUNT(*) AS n FROM ${t}`))[0][0].n;
    console.log('Demo data created:');
    for (const t of ['patients', 'appointments', 'encounters', 'lab_orders', 'prescriptions', 'dispensing', 'invoices', 'payments', 'admissions']) {
      console.log(`  ${t.padEnd(14)} ${await count(t)}`);
    }
  } catch (err) {
    await c.rollback();
    console.error('Seeding failed, nothing was saved:', err.message);
    process.exitCode = 1;
  }
  await c.end();
})();