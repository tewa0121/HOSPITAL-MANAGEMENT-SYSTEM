import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { encountersApi } from '../../api/encounters.api';
import { appointmentsApi } from '../../api/appointments.api';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { ENCOUNTER_TONE } from '../../utils/constants';
import { addDays, calcAge, formatDate, formatDateEt, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const STATUSES = ['waiting', 'triaged', 'in_consultation', 'awaiting_results', 'completed', 'cancelled'];

export default function OpdQueue() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user.role === 'doctor';
  const today = todayISO();

  const [date, setDate] = useState(today);
  const [status, setStatus] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isDoctor) appointmentsApi.doctors().then((r) => setDoctors(r.data.data)).catch(() => {});
  }, [isDoctor]);

  // refresh the queue every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let off = false;
    encountersApi.list({ date, status, doctor_id: doctorId })
      .then((res) => { if (!off) setItems(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [date, status, doctorId, tick, t]);

  const changeDate = (d) => { setLoading(true); setDate(d); };
  const counts = items.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] || 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.opd')}</h1>
        <p className="text-slate-500">{t('opd.subtitle')}</p>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-end">
          <div className="flex items-center gap-2">
            <button onClick={() => changeDate(addDays(date, -1))} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date" value={date} max={today}
              onChange={(e) => e.target.value && changeDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <button
              onClick={() => changeDate(addDays(date, 1))} disabled={date >= today}
              className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {date !== today && (
              <button onClick={() => changeDate(today)} className="rounded-lg px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50">
                {t('appointments.today')}
              </button>
            )}
          </div>
          <Select
            className="lg:w-52" value={status} onChange={(e) => { setLoading(true); setStatus(e.target.value); }}
            placeholder={t('opd.allStatuses')}
            options={STATUSES.map((s) => ({ value: s, label: t(`opd.status.${s}`) }))}
          />
          {!isDoctor && (
            <Select
              className="lg:w-60" value={doctorId} onChange={(e) => { setLoading(true); setDoctorId(e.target.value); }}
              placeholder={t('opd.allDoctors')}
              options={doctors.map((d) => ({ value: d.id, label: d.full_name }))}
            />
          )}
          <p className="text-sm text-slate-500 lg:ml-auto">{formatDate(date)} · {formatDateEt(date, i18n.language)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          {STATUSES.filter((s) => counts[s]).map((s) => (
            <Badge key={s} tone={ENCOUNTER_TONE[s]}>{t(`opd.status.${s}`)}: {counts[s]}</Badge>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" /> {t('opd.autoRefresh')}
          </span>
        </div>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('opd.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('opd.queue')}</th>
                  <th className="px-5 py-3">{t('opd.patient')}</th>
                  <th className="px-5 py-3">{t('opd.doctor')}</th>
                  <th className="px-5 py-3">{t('opd.arrived')}</th>
                  <th className="px-5 py-3">{t('opd.vitals')}</th>
                  <th className="px-5 py-3">{t('patients.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/opd/${e.id}`)}>
                    <td className="px-5 py-3">
                      {e.queue_number ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">{e.queue_number}</span>
                      ) : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{e.patient_name}</span>
                        {e.severe_allergies > 0 && (
                          <span title={t('opd.severeAllergy')} className="text-red-500"><AlertTriangle className="h-4 w-4" /></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        <span className="font-mono">{e.mrn}</span> · {calcAge(e.date_of_birth)} · {t(`patients.${e.gender}`)}
                      </p>
                    </td>
                    <td className="px-5 py-3">{e.doctor_name || '-'}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{String(e.started_at).slice(11, 16)}</td>
                    <td className="px-5 py-3">
                      {e.vitals_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-4 w-4" /> {t('opd.vitalsDone')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{t('opd.vitalsMissing')}</span>
                      )}
                    </td>
                    <td className="px-5 py-3"><Badge tone={ENCOUNTER_TONE[e.status]}>{t(`opd.status.${e.status}`)}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <span className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white">{t('opd.open')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}