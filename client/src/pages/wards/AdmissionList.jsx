import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, DoorOpen, Hourglass, Plus, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { wardsApi } from '../../api/wards.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import { AdmitModal } from './AdmitModal';
import { ADM_TONE, wardName } from '../../utils/wards';
import { calcAge, formatDateTime, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const TABS = ['admitted', 'discharged', 'all'];

export default function AdmissionList() {
  const { t, i18n } = useTranslation();
  const { can } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();

  // the consultation screen sends the visit and patient here
  const [preset] = useState(location.state?.admit || null);
  const [admitOpen, setAdmitOpen] = useState(!!location.state?.admit && can('admissions.create'));

  const [view, setView] = useState('admitted');
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ items: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (location.state?.admit) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let off = false;
    wardsApi.admissions({ status: view, date, search: query })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [view, date, query, tick, t]);

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.admissions')}</h1>
          <p className="text-slate-500">{t('adm.subtitle')}</p>
        </div>
        {can('admissions.create') && (
          <Button onClick={() => setAdmitOpen(true)}><Plus className="h-4 w-4" /> {t('adm.admitPatient')}</Button>
        )}
      </div>

      {s && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} color="teal" label={t('adm.sum.now')} value={s.now_in} />
          <StatCard icon={CalendarCheck} color="blue" label={t('adm.sum.today')} value={s.today_in} />
          <StatCard icon={DoorOpen} color="amber" label={t('adm.sum.out')} value={s.today_out} />
          <StatCard icon={Hourglass} color="violet" label={t('adm.sum.avgLos')} value={s.avg_los === null ? '-' : `${s.avg_los} ${t('adm.sum.days')}`} />
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((k) => (
          <button
            key={k} onClick={() => { setLoading(true); setView(k); }}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              view === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`adm.tab.${k}`)}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('adm.searchPh')}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          {view !== 'admitted' && !query && (
            <input
              type="date" value={date} max={todayISO()}
              onChange={(e) => { if (e.target.value) { setLoading(true); setDate(e.target.value); } }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          )}
        </div>

        {loading ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('adm.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('adm.col.patient')}</th>
                  <th className="px-5 py-3">{t('adm.col.bed')}</th>
                  <th className="px-5 py-3">{t('adm.col.doctor')}</th>
                  <th className="px-5 py-3">{t('adm.col.admitted')}</th>
                  <th className="px-5 py-3">{t('adm.col.days')}</th>
                  <th className="px-5 py-3">{t('adm.col.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/admissions/${a.id}`)}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{a.patient_name}</p>
                      <p className="text-xs text-slate-400"><span className="font-mono">{a.mrn}</span> · {calcAge(a.date_of_birth)} · {t(`patients.${a.gender}`)}</p>
                      {a.reason && <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">{a.reason}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-semibold">{a.bed_number}</span>
                      <p className="text-xs text-slate-400">{wardName(a, i18n.language)}</p>
                    </td>
                    <td className="px-5 py-3">{a.doctor_name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateTime(a.admitted_at)}</td>
                    <td className="px-5 py-3 font-medium">{a.days}</td>
                    <td className="px-5 py-3"><Badge tone={ADM_TONE[a.status]}>{t(`adm.status.${a.status}`)}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <span className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white">{t('adm.open')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {admitOpen && (
        <AdmitModal preset={preset} onClose={() => setAdmitOpen(false)} onAdmitted={(id) => navigate(`/admissions/${id}`)} />
      )}
    </div>
  );
}