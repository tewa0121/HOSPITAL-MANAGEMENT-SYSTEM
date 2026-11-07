import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../api/appointments.api';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import SlotPicker from './SlotPicker';
import { STATUS_TONE } from '../../utils/constants';
import { addDays, formatDate, formatDateEt, formatTime, todayISO } from '../../utils/formatters';

const STATUSES = ['scheduled', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show'];

export default function AppointmentList() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();

  const [date, setDate] = useState(location.state?.date || todayISO());
  const [status, setStatus] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  const [confirm, setConfirm] = useState(null); // { action: 'cancel' | 'noShow', appt }
  const [resched, setResched] = useState(null); // appointment being rescheduled
  const [rDate, setRDate] = useState('');
  const [rSlot, setRSlot] = useState('');
  const [busy, setBusy] = useState(false);

  const isDoctor = user.role === 'doctor';
  const today = todayISO();

  useEffect(() => {
    if (!isDoctor) appointmentsApi.doctors().then((res) => setDoctors(res.data.data)).catch(() => {});
  }, [isDoctor]);

  useEffect(() => {
    let off = false;
    setLoading(true);
    appointmentsApi.list({ date, status, doctor_id: doctorId })
      .then((res) => { if (!off) setItems(res.data.data); })
      .catch((err) => toast.error(err.response?.data?.message || t('login.networkError')))
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [date, status, doctorId, reload, t]);

  const counts = items.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {});
  const refresh = () => setReload((n) => n + 1);
  const fail = (err) => toast.error(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || t('login.networkError'));

  const checkIn = async (a) => {
    try {
      const res = await appointmentsApi.checkIn(a.id);
      toast.success(`${t('appointments.checkedIn')} #${res.data.data.queue_number}`);
      refresh();
    } catch (err) { fail(err); }
  };

  const runConfirm = async () => {
    setBusy(true);
    try {
      if (confirm.action === 'cancel') {
        await appointmentsApi.cancel(confirm.appt.id);
        toast.success(t('appointments.cancelled'));
      } else {
        await appointmentsApi.noShow(confirm.appt.id);
        toast.success(t('appointments.noShowMarked'));
      }
      setConfirm(null);
      refresh();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const openResched = (a) => { setResched(a); setRDate(a.appointment_date < today ? today : a.appointment_date); setRSlot(''); };

  const runResched = async () => {
    setBusy(true);
    try {
      await appointmentsApi.reschedule(resched.id, { appointment_date: rDate, start_time: rSlot });
      toast.success(t('appointments.rescheduled'));
      setResched(null);
      refresh();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const linkBtn = 'rounded-md px-2.5 py-1 text-xs font-semibold transition';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('appointments.title')}</h1>
          <p className="text-slate-500">{t('appointments.subtitle')}</p>
        </div>
        {can('appointments.create') && (
          <Button onClick={() => navigate('/appointments/new')}>
            <Plus className="h-4 w-4" /> {t('appointments.new')}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden !p-0">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-end">
          <div className="flex items-center gap-2">
            <button onClick={() => setDate(addDays(date, -1))} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <button onClick={() => setDate(addDays(date, 1))} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </button>
            {date !== today && (
              <button onClick={() => setDate(today)} className="rounded-lg px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50">
                {t('appointments.today')}
              </button>
            )}
          </div>
          <Select
            className="lg:w-52" value={status} onChange={(e) => setStatus(e.target.value)}
            placeholder={t('appointments.allStatuses')}
            options={STATUSES.map((s) => ({ value: s, label: t(`appointments.status.${s}`) }))}
          />
          {!isDoctor && (
            <Select
              className="lg:w-60" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
              placeholder={t('appointments.allDoctors')}
              options={doctors.map((d) => ({ value: d.id, label: d.full_name }))}
            />
          )}
          <p className="text-sm text-slate-500 lg:ml-auto">
            {formatDate(date)} · {formatDateEt(date, i18n.language)}
          </p>
        </div>

        {/* Status summary */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
          {STATUSES.filter((s) => counts[s]).map((s) => (
            <Badge key={s} tone={STATUS_TONE[s]}>{t(`appointments.status.${s}`)}: {counts[s]}</Badge>
          ))}
        </div>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('appointments.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('appointments.queue')}</th>
                  <th className="px-5 py-3">{t('appointments.time')}</th>
                  <th className="px-5 py-3">{t('appointments.patient')}</th>
                  <th className="px-5 py-3">{t('appointments.doctor')}</th>
                  <th className="px-5 py-3">{t('appointments.type')}</th>
                  <th className="px-5 py-3">{t('patients.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => {
                  const isToday = a.appointment_date === today;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        {a.queue_number ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                            {a.queue_number}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-medium">{formatTime(a.start_time)}</td>
                      <td className="px-5 py-3">
                        <Link to={`/patients/${a.patient_id}`} className="font-medium text-slate-800 hover:text-teal-700">{a.patient_name}</Link>
                        <p className="font-mono text-xs text-slate-400">{a.mrn}</p>
                      </td>
                      <td className="px-5 py-3">
                        {a.doctor_name}
                        <p className="text-xs text-slate-400">{a.department}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={a.type === 'walk_in' ? 'amber' : 'slate'}>
                          {a.type === 'walk_in' ? t('appointments.walkIn') : t('appointments.scheduled')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3"><Badge tone={STATUS_TONE[a.status]}>{t(`appointments.status.${a.status}`)}</Badge></td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {a.status === 'scheduled' && isToday && can('appointments.checkin') && (
                            <button onClick={() => checkIn(a)} className={`${linkBtn} bg-teal-600 text-white hover:bg-teal-700`}>
                              {t('appointments.checkIn')}
                            </button>
                          )}
                          {a.status === 'scheduled' && can('appointments.update') && (
                            <button onClick={() => openResched(a)} className={`${linkBtn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                              {t('appointments.reschedule')}
                            </button>
                          )}
                          {a.status === 'scheduled' && a.appointment_date <= today && can('appointments.update') && (
                            <button onClick={() => setConfirm({ action: 'noShow', appt: a })} className={`${linkBtn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                              {t('appointments.noShow')}
                            </button>
                          )}
                          {['scheduled', 'checked_in'].includes(a.status) && can('appointments.cancel') && (
                            <button onClick={() => setConfirm({ action: 'cancel', appt: a })} className={`${linkBtn} bg-red-50 text-red-600 hover:bg-red-100`}>
                              {t('appointments.cancel')}
                            </button>
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

      {/* Cancel / no-show confirmation */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t('form.confirm')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>{t('form.close')}</Button>
            <Button variant={confirm?.action === 'cancel' ? 'danger' : 'primary'} onClick={runConfirm} loading={busy}>
              {t('form.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {confirm && t(confirm.action === 'cancel' ? 'appointments.confirmCancel' : 'appointments.confirmNoShow', { name: confirm.appt.patient_name })}
        </p>
      </Modal>

      {/* Reschedule */}
      <Modal
        open={!!resched}
        onClose={() => setResched(null)}
        title={t('appointments.rescheduleTitle')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResched(null)}>{t('form.cancel')}</Button>
            <Button onClick={runResched} loading={busy} disabled={!rSlot}>{t('form.confirm')}</Button>
          </>
        }
      >
        {resched && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{resched.patient_name} · {resched.doctor_name}</p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('appointments.date')}</label>
              <input
                type="date" min={today} value={rDate}
                onChange={(e) => { setRDate(e.target.value); setRSlot(''); }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <SlotPicker doctorId={resched.doctor_id} date={rDate} value={rSlot} onChange={setRSlot} />
          </div>
        )}
      </Modal>
    </div>
  );
}