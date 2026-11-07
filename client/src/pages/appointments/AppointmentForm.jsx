import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../api/appointments.api';
import { patientsApi } from '../../api/patients.api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import SlotPicker from './SlotPicker';
import { fullName, todayISO } from '../../utils/formatters';

export default function AppointmentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [type, setType] = useState('scheduled');
  const [patient, setPatient] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    appointmentsApi.doctors().then((res) => setDoctors(res.data.data)).catch(() => {});
  }, []);

  // patient preselected from the patient profile page
  useEffect(() => {
    const pid = params.get('patient_id');
    if (pid) patientsApi.get(pid).then((res) => setPatient(res.data.data)).catch(() => {});
  }, [params]);

  // patient search (debounced)
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

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!patient) er.patient = t('appointments.patientRequired');
    if (!doctorId) er.doctor = t('appointments.doctorRequired');
    if (type === 'scheduled') {
      if (!date) er.date = t('appointments.dateRequired');
      if (!slot) er.slot = t('appointments.slotRequired');
    }
    setErrors(er);
    if (Object.keys(er).length) return;

    const payload = type === 'walk_in'
      ? { patient_id: patient.id, doctor_id: Number(doctorId), type, reason }
      : { patient_id: patient.id, doctor_id: Number(doctorId), type, appointment_date: date, start_time: slot, reason };

    setSaving(true);
    try {
      const res = await appointmentsApi.create(payload);
      if (type === 'walk_in') toast.success(`${t('appointments.walkInAdded')} #${res.data.data.queue_number}`);
      else toast.success(t('appointments.booked'));
      navigate('/appointments', { state: { date: type === 'walk_in' ? todayISO() : date } });
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || t('login.networkError'));
      if (err.response?.status === 409) { setSlot(''); setRefreshKey((k) => k + 1); }
    } finally {
      setSaving(false);
    }
  };

  const doctorOpts = doctors.map((d) => ({ value: d.id, label: `${d.full_name}${d.department ? ` - ${d.department}` : ''}` }));
  const typeBtn = (key, label) => (
    <button
      type="button"
      onClick={() => { setType(key); setErrors({}); }}
      className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
        type === key ? 'bg-teal-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/appointments" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700">
          <ArrowLeft className="h-4 w-4" /> {t('form.back')}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{t('appointments.newTitle')}</h1>
      </div>

      <form onSubmit={submit} className="space-y-6" noValidate>
        <Card>
          <div className="mb-5 flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {typeBtn('scheduled', t('appointments.scheduled'))}
            {typeBtn('walk_in', t('appointments.walkIn'))}
          </div>

          <div className="space-y-5">
            {/* Patient */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('appointments.patient')}<span className="text-red-500"> *</span>
              </label>
              {patient ? (
                <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 p-3">
                  <div>
                    <p className="font-semibold text-slate-800">{fullName(patient)}</p>
                    <p className="text-xs text-slate-500">{patient.mrn} · {patient.phone || '-'}</p>
                  </div>
                  <button type="button" onClick={() => { setPatient(null); setSearch(''); }} className="text-sm font-medium text-teal-700 hover:underline">
                    {t('appointments.changePatient')}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setErrors((x) => ({ ...x, patient: undefined })); }}
                    placeholder={t('appointments.searchPatientPh')}
                    className={`w-full rounded-lg border py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 ${
                      errors.patient ? 'border-red-400 focus:ring-red-500/20' : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
                    }`}
                  />
                  {searched && (
                    <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {results.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-slate-500">{t('appointments.noPatientFound')}</li>
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
                label={t('appointments.doctor')} required placeholder={t('appointments.selectDoctor')}
                options={doctorOpts} value={doctorId} error={errors.doctor}
                onChange={(e) => { setDoctorId(e.target.value); setSlot(''); setErrors((x) => ({ ...x, doctor: undefined })); }}
              />
              {type === 'scheduled' && (
                <Input
                  label={t('appointments.date')} required type="date" min={todayISO()}
                  value={date} error={errors.date}
                  onChange={(e) => { setDate(e.target.value); setSlot(''); }}
                />
              )}
            </div>

            {type === 'scheduled' ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('appointments.pickSlot')}<span className="text-red-500"> *</span>
                </label>
                <SlotPicker doctorId={doctorId} date={date} value={slot} onChange={(s) => { setSlot(s); setErrors((x) => ({ ...x, slot: undefined })); }} refreshKey={refreshKey} />
                {errors.slot && <p className="mt-1 text-xs text-red-600">{errors.slot}</p>}
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('appointments.walkInNote')}</p>
            )}

            <Input
              label={t('appointments.reason')} value={reason}
              onChange={(e) => setReason(e.target.value)} placeholder={t('appointments.reasonPh')}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>{t('form.cancel')}</Button>
          <Button type="submit" loading={saving}>
            {type === 'walk_in' ? t('appointments.bookWalkIn') : t('appointments.book')}
          </Button>
        </div>
      </form>
    </div>
  );
}