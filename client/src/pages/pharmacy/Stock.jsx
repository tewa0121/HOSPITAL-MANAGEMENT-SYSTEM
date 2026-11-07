import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Boxes, CalendarClock, Pencil, PackagePlus, Plus, Search, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { pharmacyApi } from '../../api/pharmacy.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import { BatchesModal, MedicationModal, ReceiveModal } from './StockModals';
import { daysUntil, medLabel, num, STOCK_TONE } from '../../utils/pharmacy';
import { formatBirr, formatDate } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const FILTERS = ['all', 'low', 'out', 'expiring', 'expired'];
const BAR = { ok: 'bg-green-500', low: 'bg-amber-500', out: 'bg-red-500' };

export default function Stock() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const manage = can('pharmacy.stock_manage');

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [alert, setAlert] = useState('all');
  const [data, setData] = useState({ items: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [batchesFor, setBatchesFor] = useState(null);
  const [receive, setReceive] = useState(null); // null | 'new' | medication
  const [editMed, setEditMed] = useState(null); // null | 'new' | medication

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let off = false;
    pharmacyApi.stock({ search: query, alert: alert === 'all' ? '' : alert })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [query, alert, tick, t]);

  const reload = () => setTick((n) => n + 1);
  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.stock')}</h1>
          <p className="text-slate-500">{t('pharm.s.subtitle')}</p>
        </div>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditMed('new')}><Plus className="h-4 w-4" /> {t('pharm.s.add')}</Button>
            <Button onClick={() => setReceive('new')}><PackagePlus className="h-4 w-4" /> {t('pharm.s.receive')}</Button>
          </div>
        )}
      </div>

      {s?.expired > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{t('pharm.alerts.expired', { n: s.expired })}</p>
        </div>
      )}

      {s && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Boxes} label={t('pharm.s.summary.medications')} value={s.medications} color="teal" />
          <StatCard icon={AlertTriangle} label={t('pharm.s.summary.lowOut')} value={s.low + s.out} color="amber" />
          <StatCard icon={CalendarClock} label={t('pharm.s.summary.expiring')} value={s.expiring} color="violet" />
          <StatCard icon={Wallet} label={t('pharm.s.summary.value')} value={formatBirr(s.value)} color="blue" />
        </div>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('pharm.s.searchPh')}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <Select
            className="sm:w-56" value={alert}
            onChange={(e) => { setLoading(true); setAlert(e.target.value); }}
            options={FILTERS.map((f) => ({ value: f, label: t(`pharm.s.filter.${f}`) }))}
          />
        </div>

        {loading ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('pharm.s.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('pharm.s.col.medication')}</th>
                  <th className="px-5 py-3">{t('pharm.s.col.stock')}</th>
                  <th className="px-5 py-3">{t('pharm.s.col.status')}</th>
                  <th className="px-5 py-3">{t('pharm.s.col.nextExpiry')}</th>
                  <th className="px-5 py-3">{t('pharm.s.col.price')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((m) => {
                  const width = Math.min(100, Math.round((m.stock / Math.max(m.reorder_level * 2, 1)) * 100));
                  const days = m.next_expiry ? daysUntil(m.next_expiry) : null;
                  return (
                    <tr key={m.id} className={m.is_active ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'}>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-800">{medLabel(m)}</span>
                          <span className="text-xs text-slate-400">({m.form})</span>
                          {m.is_controlled && <Badge tone="red">{t('pharm.s.controlled')}</Badge>}
                          {!m.is_active && <Badge tone="slate">{t('pharm.s.inactive')}</Badge>}
                        </div>
                        {m.brand_name && <p className="text-xs text-slate-400">{m.brand_name}</p>}
                      </td>
                      <td className="min-w-[160px] px-5 py-3">
                        <p className="font-semibold">{num(m.stock)}</p>
                        <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full ${BAR[m.status]}`} style={{ width: `${width}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{t('pharm.s.reorder')} {num(m.reorder_level)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={STOCK_TONE[m.status]}>{t(`pharm.s.status.${m.status}`)}</Badge>
                          {m.expired_qty > 0 && <Badge tone="red">{t('pharm.s.expiredQty', { n: num(m.expired_qty) })}</Badge>}
                          {m.expiring_qty > 0 && <Badge tone="amber">{t('pharm.s.expiringQty', { n: num(m.expiring_qty) })}</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {m.next_expiry ? (
                          <>
                            {formatDate(m.next_expiry)}
                            <p className="text-xs text-slate-400">{t('pharm.s.daysLeft', { n: days })}</p>
                          </>
                        ) : '-'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">{formatBirr(m.unit_price)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button onClick={() => setBatchesFor(m)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                            {t('pharm.s.batches')}
                          </button>
                          {manage && m.is_active && (
                            <button onClick={() => setReceive(m)} className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700">
                              {t('pharm.s.receive')}
                            </button>
                          )}
                          {manage && (
                            <button onClick={() => setEditMed(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700">
                              <Pencil className="h-4 w-4" />
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

      {batchesFor && (
        <BatchesModal med={batchesFor} manage={manage} onClose={() => setBatchesFor(null)} onChanged={reload} />
      )}
      {receive && (
        <ReceiveModal
          med={receive === 'new' ? null : receive}
          onClose={() => setReceive(null)}
          onSaved={() => { setReceive(null); reload(); }}
        />
      )}
      {editMed && (
        <MedicationModal
          med={editMed === 'new' ? null : editMed}
          onClose={() => setEditMed(null)}
          onSaved={() => { setEditMed(null); reload(); }}
        />
      )}
    </div>
  );
}