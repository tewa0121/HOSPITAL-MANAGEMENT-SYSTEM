const pool = require('../../config/db');
const HttpError = require('../../utils/httpError');

const NAME = "CONCAT_WS(' ', p.first_name, p.father_name, p.grandfather_name)";
const OPEN_ENC = "('waiting','triaged','in_consultation','awaiting_results')";
const PENDING_LAB = "('ordered','collected','processing','resulted')";
const EXPIRY_DAYS = 90;

// same "not yet invoiced" rules as the billing module
const UNBILLED_ENC = `e.status <> 'cancelled' AND e.encounter_type IN ('opd','emergency')
  AND e.started_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.encounter_id = e.id AND i.status <> 'cancelled')`;
const UNBILLED_ADM = `a.status IN ('admitted','discharged') AND a.admitted_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.admission_id = a.id AND i.status <> 'cancelled')`;

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const daysBetween = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
const week = () => daysBetween(addDays(today(), -6), today());

const num = (v) => Number(v || 0);
const r1 = (v) => Math.round(num(v) * 10) / 10;
const r2 = (v) => Math.round(num(v) * 100) / 100;
const pct = (a, b) => (num(b) > 0 ? r1((num(a) / num(b)) * 100) : 0);
const avg = (v) => (v === null || v === undefined ? null : r1(v));

const one = async (sql, params = []) => (await pool.query(sql, params))[0][0];
const all = async (sql, params = []) => (await pool.query(sql, params))[0];

// rows [{ d: 'YYYY-MM-DD', n }] -> one point per day, missing days are 0
const series = (days, rows, money = false) => {
  const m = new Map(rows.map((r) => [r.d, num(r.n)]));
  return days.map((date) => ({ date, value: money ? r2(m.get(date)) : (m.get(date) || 0) }));
};

const rangeSql = (col) => `${col} >= ? AND ${col} < DATE_ADD(?, INTERVAL 1 DAY)`;

function parseRange(q) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const to = re.test(q.to || '') ? q.to : today();
  const from = re.test(q.from || '') ? q.from : addDays(to, -29);
  if (iso(parse(from)) !== from || iso(parse(to)) !== to) throw new HttpError(422, 'Invalid date');
  if (from > to) throw new HttpError(422, 'The start date must not be after the end date');
  if (Math.round((parse(to) - parse(from)) / 86400000) > 365) throw new HttpError(422, 'The period can be at most one year');
  return { from, to };
}

const card = (key, value, icon, color, format = 'number') => ({ key, value, icon, color, format });
const chart = (key, type, data, extra = {}) => ({ key, type, data, ...extra });
const row = (id, title, subtitle, badge_key, tone, link, amount) => ({ id, title, subtitle, badge_key, tone, link, amount });
const list = (key, rows) => ({ key, rows });

const hm = (s) => String(s).slice(11, 16);
const qn = (q) => (q ? `#${q} · ` : '');

const ENC_TONE = { waiting: 'amber', triaged: 'blue', in_consultation: 'teal', awaiting_results: 'amber' };
const FLAG_TONE = { normal: 'green', low: 'amber', high: 'red', critical: 'red' };
const LAB_TONE = { ordered: 'slate', collected: 'blue', processing: 'blue', resulted: 'amber' };
const RX_TONE = { pending: 'amber', partially_dispensed: 'blue' };
const INV_TONE = { unpaid: 'red', partial: 'amber' };

// Stock figures shared by the pharmacy and admin dashboards and the pharmacy report
async function stockAlerts() {
  const rows = await all(
    `SELECT m.id, m.generic_name, m.strength, m.reorder_level,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity_available ELSE 0 END), 0) AS stock,
            COALESCE(SUM(CASE WHEN b.expiry_date < CURDATE() THEN b.quantity_available ELSE 0 END), 0) AS expired,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${EXPIRY_DAYS} DAY)
                              THEN b.quantity_available ELSE 0 END), 0) AS expiring,
            COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity_available * m.unit_price ELSE 0 END), 0) AS value
     FROM medications m LEFT JOIN medication_batches b ON b.medication_id = m.id
     WHERE m.is_active = 1 GROUP BY m.id`
  );
  const meds = rows.map((r) => ({
    id: r.id, name: [r.generic_name, r.strength].filter(Boolean).join(' '),
    stock: num(r.stock), reorder: num(r.reorder_level), expired: num(r.expired), expiring: num(r.expiring), value: num(r.value),
  }));
  const status = (m) => (m.stock === 0 ? 'out' : m.stock <= m.reorder ? 'low' : 'ok');
  return {
    low: meds.filter((m) => status(m) !== 'ok').sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)).map((m) => ({ ...m, status: status(m) })),
    out: meds.filter((m) => status(m) === 'out').length,
    lowOnly: meds.filter((m) => status(m) === 'low').length,
    ok: meds.filter((m) => status(m) === 'ok').length,
    expiring: meds.filter((m) => m.expiring > 0).length,
    expired: meds.filter((m) => m.expired > 0).length,
    value: r2(meds.reduce((s, m) => s + m.value, 0)),
  };
}

// ======================= DASHBOARDS =======================

async function adminDash() {
  const days = week();
  const [pt, vt, ap, inp, beds, rev, out, vs, rs, stock] = await Promise.all([
    one('SELECT COUNT(*) n FROM patients'),
    one("SELECT COUNT(*) n FROM encounters WHERE status <> 'cancelled' AND DATE(started_at) = CURDATE()"),
    one("SELECT COUNT(*) n FROM appointments WHERE status <> 'cancelled' AND appointment_date = CURDATE()"),
    one("SELECT COUNT(*) n FROM admissions WHERE status = 'admitted'"),
    one(`SELECT COUNT(*) total, COALESCE(SUM(b.status = 'occupied'), 0) occupied, COALESCE(SUM(b.status = 'available'), 0) available,
                COALESCE(SUM(b.status = 'cleaning'), 0) cleaning, COALESCE(SUM(b.status = 'maintenance'), 0) maintenance
         FROM beds b JOIN wards w ON w.id = b.ward_id WHERE w.is_active = 1`),
    one('SELECT COALESCE(SUM(amount), 0) n FROM payments WHERE DATE(paid_at) = CURDATE()'),
    one("SELECT COALESCE(SUM(total - amount_paid), 0) n FROM invoices WHERE status IN ('unpaid','partial')"),
    all("SELECT DATE(started_at) d, COUNT(*) n FROM encounters WHERE status <> 'cancelled' AND started_at >= ? GROUP BY d", [days[0]]),
    all('SELECT DATE(paid_at) d, SUM(amount) n FROM payments WHERE paid_at >= ? GROUP BY d', [days[0]]),
    stockAlerts(),
  ]);
  const staffed = num(beds.total) - num(beds.maintenance);
  return {
    cards: [
      card('patients_total', num(pt.n), 'Users', 'teal'),
      card('visits_today', num(vt.n), 'Stethoscope', 'blue'),
      card('appts_today', num(ap.n), 'CalendarDays', 'violet'),
      card('inpatients', num(inp.n), 'BedDouble', 'amber'),
      card('occupancy', pct(beds.occupied, staffed), 'Percent', 'teal', 'percent'),
      card('revenue_today', r2(rev.n), 'Wallet', 'blue', 'money'),
      card('outstanding', r2(out.n), 'Hourglass', 'amber', 'money'),
      card('stock_alerts', stock.low.length + stock.expired, 'AlertTriangle', 'violet'),
    ],
    charts: [
      chart('visits_7d', 'line', series(days, vs)),
      chart('revenue_7d', 'bar', series(days, rs, true), { money: true }),
      chart('beds', 'pie', ['available', 'occupied', 'cleaning', 'maintenance'].map((k) => ({ key: k, value: num(beds[k]) })), { ns: 'ward.status' }),
    ],
    lists: [],
  };
}

async function doctorDash(user) {
  const days = week();
  const [c, vs, queue, ready] = await Promise.all([
    one(`SELECT COALESCE(SUM(status IN ('waiting','triaged')), 0) w, COALESCE(SUM(status IN ('in_consultation','awaiting_results')), 0) i,
                COALESCE(SUM(status = 'completed'), 0) c
         FROM encounters WHERE doctor_id = ? AND DATE(started_at) = CURDATE()`, [user.id]),
    all("SELECT DATE(started_at) d, COUNT(*) n FROM encounters WHERE doctor_id = ? AND status <> 'cancelled' AND started_at >= ? GROUP BY d", [user.id, days[0]]),
    all(`SELECT e.id, e.status, ${NAME} AS patient, p.mrn, a.queue_number
         FROM encounters e JOIN patients p ON p.id = e.patient_id LEFT JOIN appointments a ON a.id = e.appointment_id
         WHERE e.doctor_id = ? AND DATE(e.started_at) = CURDATE() AND e.status IN ${OPEN_ENC}
         ORDER BY FIELD(e.status, 'in_consultation','awaiting_results','triaged','waiting'), COALESCE(a.queue_number, 9999), e.id LIMIT 8`, [user.id]),
    all(`SELECT lo.id, lo.encounter_id, lo.result_flag, lo.verified_at, t.name AS test, ${NAME} AS patient
         FROM lab_orders lo JOIN lab_tests t ON t.id = lo.test_id JOIN patients p ON p.id = lo.patient_id
         WHERE lo.ordered_by = ? AND lo.status = 'verified' AND lo.verified_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         ORDER BY lo.verified_at DESC LIMIT 6`, [user.id]),
  ]);
  const pend = await one(`SELECT COUNT(*) n FROM lab_orders WHERE ordered_by = ? AND status IN ${PENDING_LAB}`, [user.id]);
  return {
    cards: [
      card('waiting', num(c.w), 'Clock', 'amber'),
      card('in_consult', num(c.i), 'Stethoscope', 'teal'),
      card('completed_today', num(c.c), 'CheckCircle2', 'blue'),
      card('lab_pending', num(pend.n), 'FlaskConical', 'violet'),
    ],
    charts: [chart('my_visits_7d', 'bar', series(days, vs))],
    lists: [
      list('queue', queue.map((r) => row(r.id, r.patient, `${qn(r.queue_number)}${r.mrn}`, `opd.status.${r.status}`, ENC_TONE[r.status], `/opd/${r.id}`))),
      list('results_ready', ready.map((r) => row(r.id, `${r.test} · ${r.patient}`, hm(r.verified_at), `consult.lab.flag.${r.result_flag}`, FLAG_TONE[r.result_flag], `/opd/${r.encounter_id}`))),
    ],
  };
}

async function nurseDash() {
  const days = week();
  const [v, open, adm, bed, samples, vs, beds, need, clean] = await Promise.all([
    one("SELECT COUNT(*) n FROM encounters e WHERE DATE(e.started_at) = CURDATE() AND e.status = 'waiting' AND NOT EXISTS (SELECT 1 FROM vital_signs v WHERE v.encounter_id = e.id)"),
    one(`SELECT COUNT(*) n FROM encounters WHERE DATE(started_at) = CURDATE() AND status IN ${OPEN_ENC}`),
    one("SELECT COUNT(*) n FROM admissions WHERE status = 'admitted'"),
    one("SELECT COUNT(*) n FROM beds b JOIN wards w ON w.id = b.ward_id WHERE b.status = 'cleaning' AND w.is_active = 1"),
    one("SELECT COUNT(*) n FROM lab_orders WHERE status = 'ordered'"),
    all("SELECT DATE(started_at) d, COUNT(*) n FROM encounters WHERE status <> 'cancelled' AND started_at >= ? GROUP BY d", [days[0]]),
    one(`SELECT COALESCE(SUM(b.status = 'available'), 0) available, COALESCE(SUM(b.status = 'occupied'), 0) occupied,
                COALESCE(SUM(b.status = 'cleaning'), 0) cleaning, COALESCE(SUM(b.status = 'maintenance'), 0) maintenance
         FROM beds b JOIN wards w ON w.id = b.ward_id WHERE w.is_active = 1`),
    all(`SELECT e.id, ${NAME} AS patient, p.mrn, a.queue_number
         FROM encounters e JOIN patients p ON p.id = e.patient_id LEFT JOIN appointments a ON a.id = e.appointment_id
         WHERE DATE(e.started_at) = CURDATE() AND e.status = 'waiting'
           AND NOT EXISTS (SELECT 1 FROM vital_signs v WHERE v.encounter_id = e.id)
         ORDER BY COALESCE(a.queue_number, 9999), e.id LIMIT 8`),
    all(`SELECT b.id, b.bed_number, w.name AS ward FROM beds b JOIN wards w ON w.id = b.ward_id
         WHERE b.status = 'cleaning' AND w.is_active = 1 ORDER BY b.id LIMIT 8`),
  ]);
  return {
    cards: [
      card('need_vitals', num(v.n), 'HeartPulse', 'amber'),
      card('open_visits', num(open.n), 'Stethoscope', 'teal'),
      card('samples_to_collect', num(samples.n), 'FlaskConical', 'violet'),
      card('inpatients', num(adm.n), 'BedDouble', 'blue'),
      card('beds_cleaning', num(bed.n), 'ClipboardList', 'amber'),
    ],
    charts: [
      chart('visits_7d', 'line', series(days, vs)),
      chart('beds', 'pie', ['available', 'occupied', 'cleaning', 'maintenance'].map((k) => ({ key: k, value: num(beds[k]) })), { ns: 'ward.status' }),
    ],
    lists: [
      list('needs_vitals', need.map((r) => row(r.id, r.patient, `${qn(r.queue_number)}${r.mrn}`, 'opd.status.waiting', 'amber', `/opd/${r.id}`))),
      list('beds_to_clean', clean.map((r) => row(r.id, r.bed_number, r.ward, 'ward.status.cleaning', 'amber', '/wards'))),
    ],
  };
}

async function receptionDash() {
  const days = week();
  const ahead = daysBetween(today(), addDays(today(), 6));
  const [reg, ap, regs, booked, arrivals] = await Promise.all([
    one("SELECT COUNT(*) n FROM patients WHERE DATE(created_at) = CURDATE()"),
    one(`SELECT COUNT(*) n, COALESCE(SUM(status = 'checked_in'), 0) w, COALESCE(SUM(status = 'scheduled'), 0) u,
                COALESCE(SUM(type = 'walk_in'), 0) wi
         FROM appointments WHERE appointment_date = CURDATE() AND status <> 'cancelled'`),
    all('SELECT DATE(created_at) d, COUNT(*) n FROM patients WHERE created_at >= ? GROUP BY d', [days[0]]),
    all(`SELECT appointment_date d, COUNT(*) n FROM appointments
         WHERE appointment_date BETWEEN ? AND ? AND type = 'scheduled' AND status <> 'cancelled' GROUP BY d`, [ahead[0], ahead[6]]),
    all(`SELECT a.id, a.start_time, ${NAME} AS patient, p.mrn, u.full_name AS doctor
         FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.doctor_id
         WHERE a.appointment_date = CURDATE() AND a.status = 'scheduled' ORDER BY a.start_time LIMIT 8`),
  ]);
  return {
    cards: [
      card('registered_today', num(reg.n), 'UserPlus', 'teal'),
      card('appts_today', num(ap.n), 'CalendarDays', 'blue'),
      card('waiting_today', num(ap.w), 'Clock', 'amber'),
      card('upcoming_today', num(ap.u), 'CalendarClock', 'violet'),
      card('walk_ins_today', num(ap.wi), 'DoorOpen', 'teal'),
    ],
    charts: [chart('registrations_7d', 'bar', series(days, regs)), chart('booked_7d', 'bar', series(ahead, booked))],
    lists: [list('arrivals', arrivals.map((r) => row(r.id, r.patient, `${String(r.start_time).slice(0, 5)} · ${r.doctor}`, 'appointments.status.scheduled', 'blue', '/appointments')))],
  };
}

async function labDash() {
  const days = week();
  const [q, done, ts, att] = await Promise.all([
    one(`SELECT COALESCE(SUM(status = 'ordered'), 0) ordered, COALESCE(SUM(status = 'collected'), 0) collected,
                COALESCE(SUM(status = 'processing'), 0) processing, COALESCE(SUM(status = 'resulted'), 0) resulted,
                COALESCE(SUM(status = 'resulted' AND result_flag = 'critical'), 0) critical FROM lab_orders`),
    one("SELECT COUNT(*) n, AVG(TIMESTAMPDIFF(MINUTE, created_at, verified_at)) tat FROM lab_orders WHERE status = 'verified' AND DATE(verified_at) = CURDATE()"),
    all("SELECT DATE(created_at) d, COUNT(*) n FROM lab_orders WHERE status <> 'cancelled' AND created_at >= ? GROUP BY d", [days[0]]),
    all(`SELECT lo.id, lo.status, lo.priority, lo.result_flag, lo.created_at, t.name AS test, p.mrn, ${NAME} AS patient
         FROM lab_orders lo JOIN lab_tests t ON t.id = lo.test_id JOIN patients p ON p.id = lo.patient_id
         WHERE lo.status IN ${PENDING_LAB}
         ORDER BY (lo.status = 'resulted' AND lo.result_flag = 'critical') DESC, (lo.priority = 'urgent') DESC, lo.created_at LIMIT 8`),
  ]);
  return {
    cards: [
      card('to_collect', num(q.ordered), 'FlaskConical', 'amber'),
      card('in_lab', num(q.collected) + num(q.processing), 'Microscope', 'blue'),
      card('to_verify', num(q.resulted), 'ClipboardCheck', 'violet'),
      card('critical', num(q.critical), 'AlertTriangle', 'amber'),
      card('verified_today', num(done.n), 'CheckCircle2', 'teal'),
      card('avg_tat', avg(done.tat), 'Timer', 'blue', 'minutes'),
    ],
    charts: [
      chart('tests_7d', 'bar', series(days, ts)),
      chart('queue', 'pie', ['ordered', 'collected', 'processing', 'resulted'].map((k) => ({ key: k, value: num(q[k]) })), { ns: 'lab.status' }),
    ],
    lists: [list('attention', att.map((r) => {
      const critical = r.status === 'resulted' && r.result_flag === 'critical';
      const badge = critical ? 'lab.flag.critical' : r.priority === 'urgent' ? 'lab.priority.urgent' : `lab.status.${r.status}`;
      const tone = critical || r.priority === 'urgent' ? 'red' : LAB_TONE[r.status];
      return row(r.id, `${r.test} · ${r.patient}`, `${r.mrn} · ${hm(r.created_at)}`, badge, tone, '/lab');
    }))],
  };
}

async function pharmacyDash() {
  const days = week();
  const [rx, done, ds, waiting, stock] = await Promise.all([
    one("SELECT COUNT(*) n FROM prescriptions WHERE status IN ('pending','partially_dispensed')"),
    one(`SELECT COUNT(DISTINCT pi.prescription_id) n FROM dispensing d JOIN prescription_items pi ON pi.id = d.prescription_item_id
         WHERE DATE(d.dispensed_at) = CURDATE()`),
    all('SELECT DATE(dispensed_at) d, SUM(quantity) n FROM dispensing WHERE dispensed_at >= ? GROUP BY d', [days[0]]),
    all(`SELECT rx.id, rx.status, rx.created_at, ${NAME} AS patient, p.mrn FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id
         WHERE rx.status IN ('pending','partially_dispensed') ORDER BY rx.created_at LIMIT 6`),
    stockAlerts(),
  ]);
  return {
    cards: [
      card('rx_waiting', num(rx.n), 'Pill', 'amber'),
      card('dispensed_today', num(done.n), 'CheckCircle2', 'teal'),
      card('low_out', stock.low.length, 'AlertTriangle', 'violet'),
      card('expiring', stock.expiring, 'CalendarClock', 'amber'),
      card('expired', stock.expired, 'Boxes', 'blue'),
    ],
    charts: [
      chart('dispensed_7d', 'bar', series(days, ds)),
      chart('stock', 'pie', [{ key: 'ok', value: stock.ok }, { key: 'low', value: stock.lowOnly }, { key: 'out', value: stock.out }], { ns: 'pharm.s.status' }),
    ],
    lists: [
      list('waiting_rx', waiting.map((r) => row(r.id, r.patient, `${r.mrn} · ${hm(r.created_at)}`, `pharm.status.${r.status}`, RX_TONE[r.status], `/pharmacy/${r.id}`))),
      list('low_stock', stock.low.slice(0, 6).map((m) => row(m.id, m.name, `${m.stock} / ${m.reorder}`, `pharm.s.status.${m.status}`, m.status === 'out' ? 'red' : 'amber', '/stock'))),
    ],
  };
}

async function cashierDash(user) {
  const mine = !user.permissions.includes('billing.refund'); // admin-level users see the whole hospital
  const own = mine ? ' AND received_by = ?' : '';
  const op = mine ? [user.id] : [];
  const days = week();
  const [col, open, enc, adm, cs, methods, inv] = await Promise.all([
    one(`SELECT COALESCE(SUM(amount), 0) n FROM payments WHERE DATE(paid_at) = CURDATE()${own}`, op),
    one("SELECT COUNT(*) c, COALESCE(SUM(total - amount_paid), 0) s FROM invoices WHERE status IN ('unpaid','partial')"),
    one(`SELECT COUNT(*) n FROM encounters e WHERE ${UNBILLED_ENC}`),
    one(`SELECT COUNT(*) n FROM admissions a WHERE ${UNBILLED_ADM}`),
    all(`SELECT DATE(paid_at) d, SUM(amount) n FROM payments WHERE paid_at >= ?${own} GROUP BY d`, [days[0], ...op]),
    all(`SELECT method, SUM(amount) n FROM payments WHERE DATE(paid_at) = CURDATE() AND amount > 0${own} GROUP BY method`, op),
    all(`SELECT i.id, i.invoice_no, i.status, i.total - i.amount_paid AS balance, ${NAME} AS patient
         FROM invoices i JOIN patients p ON p.id = i.patient_id
         WHERE i.status IN ('unpaid','partial') ORDER BY balance DESC LIMIT 8`),
  ]);
  return {
    cards: [
      card('collected_today', r2(col.n), 'Wallet', 'teal', 'money'),
      card('invoices_open', num(open.c), 'Receipt', 'blue'),
      card('outstanding', r2(open.s), 'Hourglass', 'amber', 'money'),
      card('to_bill', num(enc.n) + num(adm.n), 'ClipboardList', 'violet'),
    ],
    charts: [
      chart('collections_7d', 'bar', series(days, cs, true), { money: true }),
      chart('methods', 'pie', methods.map((m) => ({ key: m.method, value: r2(m.n) })), { ns: 'bill.method', money: true }),
    ],
    lists: [list('open_invoices', inv.map((r) => row(r.id, r.patient, r.invoice_no, `bill.status.${r.status}`, INV_TONE[r.status], `/billing/${r.id}`, r2(r.balance))))],
  };
}

const KIND = {
  super_admin: ['admin', adminDash], hospital_admin: ['admin', adminDash], doctor: ['doctor', doctorDash],
  nurse: ['nurse', nurseDash], receptionist: ['reception', receptionDash], lab_technician: ['lab', labDash],
  pharmacist: ['pharmacy', pharmacyDash], cashier: ['cashier', cashierDash],
};

async function dashboard(user) {
  const [kind, fn] = KIND[user.role] || ['basic', null];
  const body = fn ? await fn(user) : { cards: [], charts: [], lists: [] };
  return { kind, ...body };
}

// ======================= REPORTS =======================

async function overview({ from, to }) {
  const p = [from, to];
  const days = daysBetween(from, to);
  const [np, enc, ap, ad, di, pay, bill, vs, rs] = await Promise.all([
    one(`SELECT COUNT(*) n FROM patients WHERE ${rangeSql('created_at')}`, p),
    one(`SELECT COUNT(*) n, COALESCE(SUM(status = 'completed'), 0) c FROM encounters WHERE status <> 'cancelled' AND ${rangeSql('started_at')}`, p),
    one(`SELECT COUNT(*) n, COALESCE(SUM(status = 'no_show'), 0) ns, COALESCE(SUM(appointment_date <= CURDATE()), 0) due
         FROM appointments WHERE type = 'scheduled' AND status <> 'cancelled' AND appointment_date BETWEEN ? AND ?`, p),
    one(`SELECT COUNT(*) n FROM admissions WHERE ${rangeSql('admitted_at')}`, p),
    one(`SELECT COUNT(*) n FROM admissions WHERE status = 'discharged' AND ${rangeSql('discharged_at')}`, p),
    one(`SELECT COALESCE(SUM(amount), 0) n FROM payments WHERE ${rangeSql('paid_at')}`, p),
    one(`SELECT COALESCE(SUM(total), 0) n FROM invoices WHERE status <> 'cancelled' AND ${rangeSql('created_at')}`, p),
    all(`SELECT DATE(started_at) d, COUNT(*) n FROM encounters WHERE status <> 'cancelled' AND ${rangeSql('started_at')} GROUP BY d`, p),
    all(`SELECT DATE(paid_at) d, SUM(amount) n FROM payments WHERE ${rangeSql('paid_at')} GROUP BY d`, p),
  ]);
  return {
    kpis: [
      { key: 'new_patients', value: num(np.n), format: 'number' },
      { key: 'visits', value: num(enc.n), format: 'number' },
      { key: 'completed', value: num(enc.c), format: 'number' },
      { key: 'appointments', value: num(ap.n), format: 'number' },
      { key: 'no_show_rate', value: pct(ap.ns, ap.due), format: 'percent' },
      { key: 'admissions', value: num(ad.n), format: 'number' },
      { key: 'discharges', value: num(di.n), format: 'number' },
      { key: 'net_collected', value: r2(pay.n), format: 'money' },
      { key: 'billed', value: r2(bill.n), format: 'money' },
    ],
    charts: [chart('visits', 'line', series(days, vs)), chart('collected', 'bar', series(days, rs, true), { money: true })],
    tables: [],
  };
}

async function clinical({ from, to }) {
  const p = [from, to];
  const days = daysBetween(from, to);
  const [enc, dx, dep, age, vs] = await Promise.all([
    one(`SELECT COUNT(*) n, COALESCE(SUM(status = 'completed'), 0) c,
                AVG(CASE WHEN status = 'completed' AND closed_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, started_at, closed_at) END) m
         FROM encounters WHERE status <> 'cancelled' AND ${rangeSql('started_at')}`, p),
    all(`SELECT COALESCE(d.icd10_code, '-') AS code, d.description, COUNT(*) n
         FROM diagnoses d JOIN encounters e ON e.id = d.encounter_id
         WHERE e.status <> 'cancelled' AND ${rangeSql('e.started_at')}
         GROUP BY d.icd10_code, d.description ORDER BY n DESC, d.description LIMIT 10`, p),
    all(`SELECT COALESCE(dep.name, '-') AS name, COUNT(*) n
         FROM encounters e LEFT JOIN users u ON u.id = e.doctor_id LEFT JOIN departments dep ON dep.id = u.department_id
         WHERE e.status <> 'cancelled' AND ${rangeSql('e.started_at')} GROUP BY dep.id, dep.name ORDER BY n DESC`, p),
    all(`SELECT CASE WHEN TIMESTAMPDIFF(YEAR, p.date_of_birth, e.started_at) < 5 THEN 'a'
                     WHEN TIMESTAMPDIFF(YEAR, p.date_of_birth, e.started_at) < 15 THEN 'b'
                     WHEN TIMESTAMPDIFF(YEAR, p.date_of_birth, e.started_at) < 50 THEN 'c' ELSE 'd' END AS grp, COUNT(*) n
         FROM encounters e JOIN patients p ON p.id = e.patient_id
         WHERE e.status <> 'cancelled' AND ${rangeSql('e.started_at')} GROUP BY grp ORDER BY grp`, p),
    all(`SELECT DATE(started_at) d, COUNT(*) n FROM encounters WHERE status <> 'cancelled' AND ${rangeSql('started_at')} GROUP BY d`, p),
  ]);
  return {
    kpis: [
      { key: 'visits', value: num(enc.n), format: 'number' },
      { key: 'completed', value: num(enc.c), format: 'number' },
      { key: 'avg_visit_min', value: avg(enc.m), format: 'minutes' },
    ],
    charts: [chart('visits', 'line', series(days, vs))],
    tables: [
      { key: 'top_dx', columns: [{ key: 'code', format: 'text' }, { key: 'description', format: 'text' }, { key: 'count', format: 'number' }],
        rows: dx.map((r) => ({ code: r.code, description: r.description, count: num(r.n) })) },
      { key: 'by_dept', columns: [{ key: 'department', format: 'text' }, { key: 'count', format: 'number' }],
        rows: dep.map((r) => ({ department: r.name, count: num(r.n) })) },
      { key: 'by_age', columns: [{ key: 'age_group', format: 'age' }, { key: 'count', format: 'number' }],
        rows: age.map((r) => ({ age_group: r.grp, count: num(r.n) })) },
    ],
  };
}

async function lab({ from, to }) {
  const p = [from, to];
  const days = daysBetween(from, to);
  const [k, byTest, ts] = await Promise.all([
    one(`SELECT COUNT(*) n, COALESCE(SUM(status = 'verified'), 0) v, COALESCE(SUM(status = 'rejected'), 0) rj,
                COALESCE(SUM(status = 'verified' AND result_flag <> 'normal'), 0) ab,
                COALESCE(SUM(status = 'verified' AND result_flag = 'critical'), 0) cr,
                AVG(CASE WHEN status = 'verified' THEN TIMESTAMPDIFF(MINUTE, created_at, verified_at) END) tat
         FROM lab_orders WHERE status <> 'cancelled' AND ${rangeSql('created_at')}`, p),
    all(`SELECT t.name, COUNT(*) n, COALESCE(SUM(lo.status = 'verified' AND lo.result_flag <> 'normal'), 0) ab,
                AVG(CASE WHEN lo.status = 'verified' THEN TIMESTAMPDIFF(MINUTE, lo.created_at, lo.verified_at) END) tat
         FROM lab_orders lo JOIN lab_tests t ON t.id = lo.test_id
         WHERE lo.status <> 'cancelled' AND ${rangeSql('lo.created_at')}
         GROUP BY t.id, t.name ORDER BY n DESC, t.name LIMIT 15`, p),
    all(`SELECT DATE(created_at) d, COUNT(*) n FROM lab_orders WHERE status <> 'cancelled' AND ${rangeSql('created_at')} GROUP BY d`, p),
  ]);
  return {
    kpis: [
      { key: 'tests', value: num(k.n), format: 'number' },
      { key: 'verified', value: num(k.v), format: 'number' },
      { key: 'reject_rate', value: pct(k.rj, k.n), format: 'percent' },
      { key: 'abnormal_rate', value: pct(k.ab, k.v), format: 'percent' },
      { key: 'critical', value: num(k.cr), format: 'number' },
      { key: 'avg_tat', value: avg(k.tat), format: 'minutes' },
    ],
    charts: [chart('tests', 'bar', series(days, ts))],
    tables: [{
      key: 'by_test',
      columns: [{ key: 'test', format: 'text' }, { key: 'count', format: 'number' }, { key: 'abnormal', format: 'number' }, { key: 'avg_tat', format: 'minutes' }],
      rows: byTest.map((r) => ({ test: r.name, count: num(r.n), abnormal: num(r.ab), avg_tat: avg(r.tat) })),
    }],
  };
}

async function inpatient({ from, to }) {
  const p = [from, to];
  const days = daysBetween(from, to);
  const [ad, di, los, now, beds, byWard, as] = await Promise.all([
    one(`SELECT COUNT(*) n FROM admissions WHERE ${rangeSql('admitted_at')}`, p),
    one(`SELECT COUNT(*) n FROM admissions WHERE status = 'discharged' AND ${rangeSql('discharged_at')}`, p),
    one(`SELECT AVG(TIMESTAMPDIFF(MINUTE, admitted_at, discharged_at)) / 1440 AS d FROM admissions WHERE status = 'discharged' AND ${rangeSql('discharged_at')}`, p),
    one("SELECT COUNT(*) n FROM admissions WHERE status = 'admitted'"),
    one("SELECT COALESCE(SUM(b.status = 'occupied'), 0) occ, COALESCE(SUM(b.status <> 'maintenance'), 0) staffed FROM beds b JOIN wards w ON w.id = b.ward_id WHERE w.is_active = 1"),
    all(`SELECT w.name, COUNT(*) n, AVG(CASE WHEN a.status = 'discharged' THEN TIMESTAMPDIFF(MINUTE, a.admitted_at, a.discharged_at) END) / 1440 AS los
         FROM admissions a JOIN beds b ON b.id = a.bed_id JOIN wards w ON w.id = b.ward_id
         WHERE ${rangeSql('a.admitted_at')} GROUP BY w.id, w.name ORDER BY n DESC`, p),
    all(`SELECT DATE(admitted_at) d, COUNT(*) n FROM admissions WHERE ${rangeSql('admitted_at')} GROUP BY d`, p),
  ]);
  return {
    kpis: [
      { key: 'admissions', value: num(ad.n), format: 'number' },
      { key: 'discharges', value: num(di.n), format: 'number' },
      { key: 'avg_los', value: avg(los.d), format: 'days' },
      { key: 'now_in', value: num(now.n), format: 'number' },
      { key: 'occupancy_now', value: pct(beds.occ, beds.staffed), format: 'percent' },
    ],
    charts: [chart('admissions', 'bar', series(days, as))],
    tables: [{
      key: 'by_ward',
      columns: [{ key: 'ward', format: 'text' }, { key: 'count', format: 'number' }, { key: 'avg_los', format: 'days' }],
      rows: byWard.map((r) => ({ ward: r.name, count: num(r.n), avg_los: avg(r.los) })),
    }],
  };
}

async function finance({ from, to }, user) {
  const mine = !user.permissions.includes('billing.refund');
  const own = mine ? ' AND received_by = ?' : '';
  const op = mine ? [user.id] : [];
  const p = [from, to];
  const days = daysBetween(from, to);
  const [methods, inv, out, byType, ds] = await Promise.all([
    all(`SELECT method, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) c,
                COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) r
         FROM payments WHERE ${rangeSql('paid_at')}${own} GROUP BY method ORDER BY c DESC`, [...p, ...op]),
    one(`SELECT COALESCE(SUM(total), 0) b, COALESCE(SUM(discount), 0) d FROM invoices WHERE status <> 'cancelled' AND ${rangeSql('created_at')}`, p),
    one("SELECT COALESCE(SUM(total - amount_paid), 0) n FROM invoices WHERE status IN ('unpaid','partial')"),
    mine ? [] : all(`SELECT COALESCE(ii.reference_type, 'other') AS t, SUM(ii.line_total) n
                     FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
                     WHERE i.status <> 'cancelled' AND ${rangeSql('i.created_at')} GROUP BY t ORDER BY n DESC`, p),
    all(`SELECT DATE(paid_at) d, SUM(amount) n FROM payments WHERE ${rangeSql('paid_at')}${own} GROUP BY d`, [...p, ...op]),
  ]);
  const collected = methods.reduce((s, m) => s + Math.round(num(m.c) * 100), 0) / 100;
  const refunded = methods.reduce((s, m) => s + Math.round(num(m.r) * 100), 0) / 100;
  const tables = [{
    key: 'by_method',
    columns: [{ key: 'method', format: 'method' }, { key: 'collected', format: 'money' }, { key: 'refunded', format: 'money' }, { key: 'net', format: 'money' }],
    rows: methods.map((m) => ({ method: m.method, collected: r2(m.c), refunded: r2(m.r), net: r2(num(m.c) - num(m.r)) })),
  }];
  if (!mine) {
    tables.push({
      key: 'by_type', columns: [{ key: 'type', format: 'category' }, { key: 'amount', format: 'money' }],
      rows: byType.map((r) => ({ type: r.t, amount: r2(r.n) })),
    });
  }
  return {
    scope: mine ? 'mine' : 'all',
    kpis: [
      { key: 'collected', value: r2(collected), format: 'money' },
      { key: 'refunded', value: r2(refunded), format: 'money' },
      { key: 'net_collected', value: r2(collected - refunded), format: 'money' },
      { key: 'billed', value: r2(inv.b), format: 'money' },
      { key: 'discounts', value: r2(inv.d), format: 'money' },
      { key: 'outstanding', value: r2(out.n), format: 'money' },
    ],
    charts: [chart('collected', 'bar', series(days, ds, true), { money: true })],
    tables,
  };
}

async function pharmacy({ from, to }) {
  const p = [from, to];
  const days = daysBetween(from, to);
  const [k, top, ds, stock] = await Promise.all([
    one(`SELECT COALESCE(SUM(d.quantity), 0) u, COUNT(DISTINCT pi.prescription_id) rx, COALESCE(SUM(d.quantity * m.unit_price), 0) v
         FROM dispensing d JOIN prescription_items pi ON pi.id = d.prescription_item_id JOIN medications m ON m.id = pi.medication_id
         WHERE ${rangeSql('d.dispensed_at')}`, p),
    all(`SELECT CONCAT_WS(' ', m.generic_name, m.strength) AS name, SUM(d.quantity) u, COUNT(DISTINCT pi.prescription_id) rx
         FROM dispensing d JOIN prescription_items pi ON pi.id = d.prescription_item_id JOIN medications m ON m.id = pi.medication_id
         WHERE ${rangeSql('d.dispensed_at')} GROUP BY m.id, m.generic_name, m.strength ORDER BY u DESC LIMIT 10`, p),
    all(`SELECT DATE(dispensed_at) d, SUM(quantity) n FROM dispensing WHERE ${rangeSql('dispensed_at')} GROUP BY d`, p),
    stockAlerts(),
  ]);
  return {
    kpis: [
      { key: 'dispensed_units', value: num(k.u), format: 'number' },
      { key: 'dispensed_rx', value: num(k.rx), format: 'number' },
      { key: 'dispensed_value', value: r2(k.v), format: 'money' },
      { key: 'stock_value', value: stock.value, format: 'money' },
      { key: 'low_out', value: stock.low.length, format: 'number' },
      { key: 'expiring_meds', value: stock.expiring, format: 'number' },
      { key: 'expired_meds', value: stock.expired, format: 'number' },
    ],
    charts: [chart('dispensed', 'bar', series(days, ds))],
    tables: [
      { key: 'top_meds', columns: [{ key: 'medicine', format: 'text' }, { key: 'units', format: 'number' }, { key: 'rx', format: 'number' }],
        rows: top.map((r) => ({ medicine: r.name, units: num(r.u), rx: num(r.rx) })) },
      { key: 'low_stock', columns: [{ key: 'medicine', format: 'text' }, { key: 'stock', format: 'number' }, { key: 'reorder', format: 'number' }],
        rows: stock.low.slice(0, 15).map((m) => ({ medicine: m.name, stock: m.stock, reorder: m.reorder })) },
    ],
  };
}

const SECTIONS = { overview, clinical, lab, inpatient, finance, pharmacy };

async function section(name, query, user) {
  const fn = SECTIONS[name];
  if (!fn) throw new HttpError(404, 'Unknown report');
  const range = parseRange(query);
  return { section: name, ...range, ...(await fn(range, user)) };
}

module.exports = { dashboard, section, parseRange, SECTION_NAMES: Object.keys(SECTIONS) };