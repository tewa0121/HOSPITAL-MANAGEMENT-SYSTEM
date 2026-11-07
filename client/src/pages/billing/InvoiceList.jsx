import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, FilePlus2, Hourglass, Receipt, Search, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Pagination from '../../components/ui/Pagination';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import { INV_TONE } from '../../utils/billing';
import UnbilledAdmissions from './UnbilledAdmissions';
import { formatBirr, formatDate, formatDateTime, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const LIMIT = 10;

export default function InvoiceList() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const navigate = useNavigate();
  const canCreate = can('billing.invoice_create');

  const [view, setView] = useState(canCreate ? 'tobill' : 'open');
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [unbilled, setUnbilled] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    billingApi.summary().then((r) => setSummary(r.data.data)).catch(() => {});
  }, [tick]);

  useEffect(() => {
    let off = false;
    const request = view === 'tobill'
      ? billingApi.unbilled({ search: query }).then((r) => { if (!off) setUnbilled(r.data.data); })
      : billingApi.invoices({ status: view, date, search: query, page, limit: LIMIT }).then((r) => { if (!off) setData(r.data.data); });
    request
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [view, date, query, page, tick, t]);

  const changeView = (v) => { setLoading(true); setPage(1); setView(v); };

  const createInvoice = async (e) => {
    setBusyId(e.id);
    try {
      const res = await billingApi.create({ encounter_id: Number(e.id) });
      toast.success(`${t('bill.msg.created')}: ${res.data.data.invoice_no}`);
      navigate(`/billing/${res.data.data.id}`);
    } catch (err) {
      toast.error(errMsg(err));
      setTick((n) => n + 1);
    } finally {
      setBusyId(null);
    }
  };

  const tabs = [...(canCreate ? ['tobill'] : []), 'open', 'paid', 'cancelled', 'all'];
  const s = summary;
  const isTobill = view === 'tobill';
  const rows = isTobill ? unbilled : data.items;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.billing')}</h1>
        <p className="text-slate-500">{t('bill.subtitle')}</p>
      </div>

      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Wallet} color="teal" value={formatBirr(s.net)}
              label={s.scope === 'mine' ? t('bill.sum.collectedMine') : t('bill.sum.collected')}
            />
            <StatCard icon={Hourglass} color="amber" value={formatBirr(s.outstanding.amount)} label={`${t('bill.sum.outstanding')} (${s.outstanding.count} ${t('bill.sum.open')})`} />
            {canCreate && <StatCard icon={ClipboardList} color="violet" value={s.unbilled} label={t('bill.sum.toBill')} />}
            <StatCard icon={Receipt} color="blue" value={formatBirr(s.refunded)} label={`${t('bill.sum.refunded')}`} />
          </div>
          {s.methods.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{t('bill.sum.byMethod')}:</span>
              {s.methods.map((m) => (
                <Badge key={m.method} tone="teal">{t(`bill.method.${m.method}`)}: {formatBirr(m.collected - m.refunded)}</Badge>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((k) => (
          <button
            key={k} onClick={() => changeView(k)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              view === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`bill.tab.${k}`)}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('bill.searchPh')}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          {['paid', 'cancelled', 'all'].includes(view) && !query && (
            <input
              type="date" value={date} max={todayISO()}
              onChange={(e) => { if (e.target.value) { setLoading(true); setPage(1); setDate(e.target.value); } }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          )}
          <span className="text-xs text-slate-400 sm:ml-auto">{t('bill.autoRefresh')}</span>
        </div>

        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{isTobill ? t('bill.emptyToBill') : t('bill.empty')}</p>
        ) : isTobill ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('bill.col.patient')}</th>
                  <th className="px-5 py-3">{t('bill.col.visit')}</th>
                  <th className="px-5 py-3">{t('bill.col.doctor')}</th>
                  <th className="px-5 py-3">{t('bill.col.services')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unbilled.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{e.patient_name}</p>
                      <p className="font-mono text-xs text-slate-400">{e.mrn}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Badge tone={e.encounter_type === 'emergency' ? 'red' : 'blue'}>{t(`bill.vtype.${e.encounter_type}`)}</Badge>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(e.started_at)}</p>
                    </td>
                    <td className="px-5 py-3">
                      {e.doctor_name || '-'}
                      <p className="text-xs text-slate-400">{e.department}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {e.lab_count} {t('bill.labs')} · {e.rx_count} {t('bill.meds')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button className="!px-3 !py-1.5" loading={busyId === e.id} onClick={() => createInvoice(e)}>
                        <FilePlus2 className="h-4 w-4" /> {t('bill.act.create')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('bill.col.invoice')}</th>
                    <th className="px-5 py-3">{t('bill.col.patient')}</th>
                    <th className="px-5 py-3">{t('bill.col.date')}</th>
                    <th className="px-5 py-3 text-right">{t('bill.col.total')}</th>
                    <th className="px-5 py-3 text-right">{t('bill.col.paid')}</th>
                    <th className="px-5 py-3 text-right">{t('bill.col.balance')}</th>
                    <th className="px-5 py-3">{t('bill.col.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((i) => (
                    <tr key={i.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/billing/${i.id}`)}>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-600">{i.invoice_no}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{i.patient_name}</p>
                        <p className="font-mono text-xs text-slate-400">{i.mrn}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(i.created_at)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-medium">{formatBirr(i.total)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">{formatBirr(i.amount_paid)}</td>
                      <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${i.balance > 0 && i.status !== 'cancelled' ? 'text-red-600' : 'text-slate-400'}`}>
                        {i.status === 'cancelled' ? '-' : formatBirr(i.balance)}
                      </td>
                      <td className="px-5 py-3"><Badge tone={INV_TONE[i.status]}>{t(`bill.status.${i.status}`)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page || page} pages={data.pages} total={data.total} limit={LIMIT} onChange={(p) => { setLoading(true); setPage(p); }} />
          </>
        )}
        
      </Card>
      {view === 'tobill' && <UnbilledAdmissions query={query} tick={tick} />}
    </div>
  );
}