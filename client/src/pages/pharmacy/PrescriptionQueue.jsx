import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Clock, Pill, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { pharmacyApi } from '../../api/pharmacy.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import { RX_TONE } from '../../utils/pharmacy';
import { calcAge, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const TABS = ['active', 'dispensed', 'cancelled', 'all'];

export default function PrescriptionQueue() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [view, setView] = useState('active');
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ items: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

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
    pharmacyApi.prescriptions({ status: view, date, search: query })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [view, date, query, tick, t]);

  const s = data.summary;
  const stock = s?.stock;
  const canStock = can('pharmacy.stock_read');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.pharmacy')}</h1>
        <p className="text-slate-500">{t('pharm.subtitle')}</p>
      </div>

      {stock?.expired > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{t('pharm.alerts.expired', { n: stock.expired })}</p>
          {canStock && <Link to="/stock" className="text-sm font-medium underline">{t('pharm.alerts.viewStock')}</Link>}
        </div>
      )}
      {stock && (stock.low_out > 0 || stock.expiring > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium">
            {stock.low_out > 0 && <p>{t('pharm.alerts.lowOut', { n: stock.low_out })}</p>}
            {stock.expiring > 0 && <p>{t('pharm.alerts.expiring', { n: stock.expiring })}</p>}
          </div>
          {canStock && <Link to="/stock" className="text-sm font-medium underline">{t('pharm.alerts.viewStock')}</Link>}
        </div>
      )}

      {s && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Clock} label={t('pharm.summary.pending')} value={s.pending} color="amber" />
          <StatCard icon={Pill} label={t('pharm.summary.partial')} value={s.partial} color="blue" />
          <StatCard icon={CheckCircle2} label={t('pharm.summary.today')} value={s.dispensed_today} color="teal" />
          {stock && <StatCard icon={AlertTriangle} label={t('pharm.summary.lowOut')} value={stock.low_out} color="violet" />}
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
            {t(`pharm.tab.${k}`)}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('pharm.searchPh')}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          {view !== 'active' && (
            <input
              type="date" value={date} max={todayISO()}
              onChange={(e) => { if (e.target.value) { setLoading(true); setDate(e.target.value); } }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          )}
          <span className="text-xs text-slate-400 sm:ml-auto">{t('pharm.autoRefresh')}</span>
        </div>

        {loading ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('pharm.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('pharm.col.patient')}</th>
                  <th className="px-5 py-3">{t('pharm.col.medicines')}</th>
                  <th className="px-5 py-3">{t('pharm.col.doctor')}</th>
                  <th className="px-5 py-3">{t('pharm.col.time')}</th>
                  <th className="px-5 py-3">{t('pharm.col.remaining')}</th>
                  <th className="px-5 py-3">{t('pharm.col.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/pharmacy/${r.id}`)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{r.patient_name}</span>
                        {r.severe_allergies > 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                      <p className="text-xs text-slate-400">
                        <span className="font-mono">{r.mrn}</span> · {calcAge(r.date_of_birth)} · {t(`patients.${r.gender}`)}
                      </p>
                    </td>
                    <td className="max-w-xs px-5 py-3 text-slate-600">
                      <p className="truncate">{r.medicines}</p>
                      <p className="text-xs text-slate-400">{r.item_count}</p>
                    </td>
                    <td className="px-5 py-3">{r.doctor_name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{String(r.created_at).slice(11, 16)}</td>
                    <td className="whitespace-nowrap px-5 py-3">{r.remaining} {t('pharm.units')}</td>
                    <td className="px-5 py-3"><Badge tone={RX_TONE[r.status]}>{t(`pharm.status.${r.status}`)}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <span className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white">{t('pharm.open')}</span>
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