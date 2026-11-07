import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, PhoneCall, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { requestsApi } from '../../api/requests.api';
import { appointmentsApi } from '../../api/appointments.api';
import { patientsApi } from '../../api/patients.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import SlotPicker from '../appointments/SlotPicker';
import { formatDate, fullName, todayISO } from '../../utils/formatters';

const STATUSES = ['new', 'contacted', 'scheduled', 'cancelled'];
const TONE = { new: 'amber', contacted: 'blue', scheduled: 'green', cancelled: 'red' };
const errText = (err, fallback) => err.response?.data?.errors?.[0]?.message || err.response?.data?.message || fallback;

/* ---------- turn a request into a real appointment ---------- */
function ScheduleModal({ request, onClose, onDone }) {
  const { t } = useTranslation();
  const firstWord = (request.full_name || '').trim().split(' ')[0]; // patient search matches one name part at a time
  const [search, setSearch] = useState(firstWord);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [patient, setPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(request.preferred_date < todayISO() ? todayISO() : request.preferred_date);
  const [slot, setSlot] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    appointmentsApi.doctors().then((res) => setDoctors(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (patient || search.trim().length < 2) { setResults([]); setSearched(false); return undefined; }
    let off = false;
    const id = setTimeout(() => {
      patientsApi.list({ search: search.trim(), status: 'active', limit: 6 })
        .then((res) => { if (!off) { setResults(res.data.data.items); setSearched(true); } })
        .catch(() => {});
    }, 300);
    return () => { off = true; clearTimeout(id); };
  }, [search, patient]);

  const submit = async () => {
    const er = {};
    if (!patient) er.patient = t('requests.patientRequired');
    if (!doctorId) er.doctor = t('requests.doctorRequired');
    if (!slot) er.slot = t('requests.slotRequired');
    setErrors(er);
    if (Object.keys(er).length) { setFormError(Object.values(er).join(' · ')); return; }
    setFormError('');
    setBusy(true);
    try {
      await requestsApi.schedule(request.id, {
        patient_id: patient.id, doctor_id: Number(doctorId), appointment_date: date, start_time: slot,
      });
      toast.success(t('requests.booked'), { duration: 6000 });
      onDone();
    } catch (err) {
      const msg = `${errText(err, t('login.networkError'))}${err.response?.status ? ` (${err.response.status})` : ''}`;
      console.error('Schedule request failed', err.response?.data || err);
      setFormError(msg);
      toast.error(msg);
      if (err.response?.status === 409) { setSlot(''); setRefreshKey((k) => k + 1); }
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open onClose={onClose} size="lg" title={t('requests.scheduleTitle')}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.close')}</Button>
          <Button onClick={submit} loading={busy}>{t('requests.schedule')}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-800">{request.full_name} · {request.phone}</p>
          <p className="text-slate-500">{request.department} · {formatDate(request.preferred_date)}</p>
          {request.message && <p className="mt-1 text-slate-600">{request.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('requests.patient')}<span className="text-red-500"> *</span></label>
          {patient ? (
            <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div>
                <p className="font-semibold text-slate-800">{fullName(patient)}</p>
                <p className="text-xs text-slate-500">{patient.mrn} · {patient.phone || '-'}</p>
              </div>
              <button type="button" onClick={() => { setPatient(null); setSearch(firstWord); }} className="text-sm font-medium text-teal-700 hover:underline">
                {t('requests.changePatient')}
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('requests.searchPatient')}
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {searched && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {results.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500">
                      {t('requests.noPatient')}{' '}
                      <Link to="/patients/new" className="font-medium text-teal-700 hover:underline">{t('requests.registerNew')}</Link>
                    </li>
                  ) : results.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => { setPatient(p); setResults([]); }} className="w-full px-4 py-2.5 text-left hover:bg-teal-50">
                        <p className="text-sm font-medium text-slate-800">{fullName(p)}</p>
                        <p className="text-xs text-slate-500">{p.mrn} · {p.phone || '-'}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {errors.patient && <p className="mt-1 text-xs text-red-600">{errors.patient}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('requests.doctor')} required placeholder={t('requests.selectDoctor')} error={errors.doctor}
            options={doctors.map((d) => ({ value: d.id, label: `${d.full_name}${d.department ? ` - ${d.department}` : ''}` }))}
            value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setSlot(''); }}
          />
          <Input label={t('requests.date')} required type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(''); }} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('requests.pickSlot')}<span className="text-red-500"> *</span></label>
          <SlotPicker doctorId={doctorId} date={date} value={slot} onChange={(s) => { setSlot(s); setErrors((x) => ({ ...x, slot: undefined })); }} refreshKey={refreshKey} />
          {errors.slot && <p className="mt-1 text-xs text-red-600">{errors.slot}</p>}
        </div>

        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</p>}
      </div>
    </Modal>
  );
}

/* ---------- page ---------- */
export default function RequestList() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('new');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [target, setTarget] = useState(null); // request being scheduled
  const [cancelReq, setCancelReq] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    setLoading(true);
    const id = setTimeout(() => {
      requestsApi.list({ status, search })
        .then((res) => { if (!off) { setItems(res.data.data.items); setCounts(res.data.data.counts); } })
        .catch((err) => toast.error(errText(err, t('login.networkError'))))
        .finally(() => { if (!off) setLoading(false); });
    }, 250);
    return () => { off = true; clearTimeout(id); };
  }, [status, search, reload, t]);

  const refresh = () => setReload((n) => n + 1);

  const markContacted = async (r) => {
    try {
      await requestsApi.setStatus(r.id, { status: 'contacted' });
      toast.success(t('requests.updated'));
      refresh();
    } catch (err) { toast.error(errText(err, t('login.networkError'))); }
  };

  const runCancel = async () => {
    setBusy(true);
    try {
      await requestsApi.setStatus(cancelReq.id, { status: 'cancelled' });
      toast.success(t('requests.updated'));
      setCancelReq(null);
      refresh();
    } catch (err) { toast.error(errText(err, t('login.networkError'))); } finally { setBusy(false); }
  };

  const tab = (key, label, n) => (
    <button
      key={key} onClick={() => setStatus(key)}
      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${status === key ? 'bg-teal-600 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
    >
      {label}{n !== undefined && <span className="ml-1.5 opacity-80">({n || 0})</span>}
    </button>
  );
  const linkBtn = 'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('requests.title')}</h1>
        <p className="text-slate-500">{t('requests.subtitle')}</p>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {tab('', t('requests.all'))}
            {STATUSES.map((s) => tab(s, t(`requests.status.${s}`), counts[s]))}
          </div>
          <div className="relative lg:ml-auto lg:w-72">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('requests.search')}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {loading ? <Spinner /> : items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('requests.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('requests.ref')}</th>
                  <th className="px-5 py-3">{t('requests.name')}</th>
                  <th className="px-5 py-3">{t('requests.department')}</th>
                  <th className="px-5 py-3">{t('requests.preferred')}</th>
                  <th className="px-5 py-3">{t('requests.statusCol')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((r) => {
                  const open = r.status === 'new' || r.status === 'contacted';
                  return (
                    <tr key={r.id} className="align-top hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-slate-500">{r.reference || `#${r.id}`}</span>
                        <p className="text-xs text-slate-400">{formatDate(String(r.created_at).slice(0, 10))}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{r.full_name}</p>
                        <a href={`tel:${r.phone}`} className="text-xs text-teal-700 hover:underline">{r.phone}</a>
                        {r.message && <p className="mt-1 max-w-xs text-xs text-slate-500">{r.message}</p>}
                      </td>
                      <td className="px-5 py-3">{r.department}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatDate(r.preferred_date)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={TONE[r.status]}>{t(`requests.status.${r.status}`)}</Badge>
                        {r.handled_by_name && <p className="mt-1 text-xs text-slate-400">{t('requests.handledBy')}: {r.handled_by_name}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {r.status === 'new' && (
                            <button onClick={() => markContacted(r)} className={`${linkBtn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                              <PhoneCall className="h-3.5 w-3.5" /> {t('requests.markContacted')}
                            </button>
                          )}
                          {open && (
                            <button onClick={() => setTarget(r)} className={`${linkBtn} bg-teal-600 text-white hover:bg-teal-700`}>
                              <CalendarPlus className="h-3.5 w-3.5" /> {t('requests.schedule')}
                            </button>
                          )}
                          {open && (
                            <button onClick={() => setCancelReq(r)} className={`${linkBtn} bg-red-50 text-red-600 hover:bg-red-100`}>
                              {t('requests.cancelReq')}
                            </button>
                          )}
                          {r.status === 'scheduled' && (
                            <Link to="/appointments" className={`${linkBtn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>{t('requests.viewAppt')}</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {target && <ScheduleModal request={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); setStatus('scheduled'); refresh(); }} />}

      <Modal
        open={!!cancelReq} onClose={() => setCancelReq(null)} title={t('form.confirm')} size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCancelReq(null)}>{t('form.close')}</Button>
            <Button variant="danger" onClick={runCancel} loading={busy}>{t('form.confirm')}</Button>
          </>
        )}
      >
        <p className="text-sm text-slate-600">{t('requests.cancelAsk', { name: cancelReq?.full_name })}</p>
      </Modal>
    </div>
  );
}
