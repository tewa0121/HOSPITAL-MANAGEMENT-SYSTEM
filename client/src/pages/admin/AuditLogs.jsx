import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronRight, Lock, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Pagination from '../../components/ui/Pagination';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import { actionTone } from '../../utils/admin';
import { addDays, formatDateTime, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const LIMIT = 20;
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

function DateRange({ from, to, onFrom, onTo }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      {t('admin.audit.from')} <input type="date" className={`${inputCls} !w-auto`} value={from} max={to} onChange={(e) => e.target.value && onFrom(e.target.value)} />
      {t('admin.audit.to')} <input type="date" className={`${inputCls} !w-auto`} value={to} max={todayISO()} onChange={(e) => e.target.value && onTo(e.target.value)} />
    </div>
  );
}

function ActivityLog() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(addDays(todayISO(), -6));
  const [to, setTo] = useState(todayISO());
  const [userId, setUserId] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [record, setRecord] = useState('');
  const [recordQ, setRecordQ] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ modules: [], actions: [], users: [] });
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(new Set());

  const rangeError = from > to;

  useEffect(() => { adminApi.auditFilters().then((r) => setFilters(r.data.data)).catch(() => {}); }, []);

  useEffect(() => {
    const id = setTimeout(() => { setRecordQ(record.trim()); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [record]);

  useEffect(() => {
    if (rangeError) return undefined;
    let off = false;
    adminApi.audit({ from, to, user_id: userId, module, action, search: recordQ, page, limit: LIMIT })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [from, to, userId, module, action, recordQ, page, rangeError, t]);

  const change = (setter) => (e) => { setLoading(true); setPage(1); setter(e.target.value); };
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card className="overflow-hidden !p-0">
      <div className="space-y-3 border-b border-slate-100 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Select value={userId} onChange={change(setUserId)} placeholder={t('admin.audit.allUsers')}
            options={filters.users.map((u) => ({ value: u.id, label: `${u.full_name} (@${u.username})` }))} />
          <Select value={module} onChange={change(setModule)} placeholder={t('admin.audit.allModules')}
            options={filters.modules.map((m) => ({ value: m, label: m }))} />
          <Select value={action} onChange={change(setAction)} placeholder={t('admin.audit.allActions')}
            options={filters.actions.map((a) => ({ value: a, label: a }))} />
          <input className={inputCls} value={record} onChange={(e) => setRecord(e.target.value)} placeholder={t('admin.audit.recordPh')} />
        </div>
        <DateRange from={from} to={to} onFrom={(v) => { setLoading(true); setPage(1); setFrom(v); }} onTo={(v) => { setLoading(true); setPage(1); setTo(v); }} />
        {rangeError && <p className="text-sm text-red-600">{t('admin.audit.rangeError')}</p>}
      </div>

      {loading ? <Spinner /> : data.items.length === 0 ? (
        <p className="py-16 text-center text-slate-500">{t('admin.audit.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-3 py-3">{t('admin.audit.time')}</th>
                  <th className="px-3 py-3">{t('admin.audit.user')}</th>
                  <th className="px-3 py-3">{t('admin.audit.action')}</th>
                  <th className="px-3 py-3">{t('admin.audit.module')}</th>
                  <th className="px-3 py-3">{t('admin.audit.record')}</th>
                  <th className="px-3 py-3">{t('admin.audit.col.ip')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => {
                  const expanded = open.has(r.id);
                  const hasMore = r.details !== null || r.details_hidden;
                  return (
                    <Fragment key={r.id}>
                      <tr className={`${hasMore ? 'cursor-pointer' : ''} hover:bg-slate-50`} onClick={() => hasMore && toggle(r.id)}>
                        <td className="px-3 py-2.5 text-slate-400">
                          {hasMore && (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatDateTime(r.created_at)}</td>
                        <td className="px-3 py-2.5">
                          {r.user_name ? <><span className="font-medium text-slate-800">{r.user_name}</span><span className="block text-xs text-slate-400">@{r.username}</span></> : <span className="text-slate-400">{t('admin.audit.system')}</span>}
                        </td>
                        <td className="px-3 py-2.5"><Badge tone={actionTone(r.action)}>{r.action}</Badge></td>
                        <td className="px-3 py-2.5 text-slate-600">{r.module}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.record_id || '-'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{r.ip_address || '-'}</td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50">
                          <td />
                          <td colSpan={6} className="px-3 py-3">
                            {r.details_hidden ? (
                              <p className="flex items-center gap-2 text-sm italic text-slate-500"><Lock className="h-4 w-4" /> {t('admin.audit.hidden')}</p>
                            ) : (
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                                {typeof r.details === 'string' ? r.details : JSON.stringify(r.details, null, 2)}
                              </pre>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page || page} pages={data.pages} total={data.total} limit={LIMIT} onChange={(p) => { setLoading(true); setPage(p); }} />
        </>
      )}
    </Card>
  );
}

function LoginLog() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(addDays(todayISO(), -6));
  const [to, setTo] = useState(todayISO());
  const [result, setResult] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, summary: null });
  const [loading, setLoading] = useState(true);

  const rangeError = from > to;

  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (rangeError) return undefined;
    let off = false;
    adminApi.logins({ from, to, result, search: query, page, limit: LIMIT })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [from, to, result, query, page, rangeError, t]);

  const s = data.summary;

  return (
    <div className="space-y-6">
      {s && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={LogIn} color="teal" label={t('admin.audit.sum.success24')} value={s.success_24h} />
          <StatCard icon={AlertTriangle} color="amber" label={t('admin.audit.sum.failed24')} value={s.failed_24h} />
          <StatCard icon={Lock} color="violet" label={t('admin.audit.sum.locked')} value={s.locked_now} />
        </div>
      )}
      <Card className="overflow-hidden !p-0">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.audit.usernamePh')} />
            <Select value={result} placeholder={t('admin.audit.result.all')}
              options={[{ value: 'success', label: t('admin.audit.result.success') }, { value: 'failed', label: t('admin.audit.result.failed') }]}
              onChange={(e) => { setLoading(true); setPage(1); setResult(e.target.value); }} />
          </div>
          <DateRange from={from} to={to} onFrom={(v) => { setLoading(true); setPage(1); setFrom(v); }} onTo={(v) => { setLoading(true); setPage(1); setTo(v); }} />
          {rangeError && <p className="text-sm text-red-600">{t('admin.audit.rangeError')}</p>}
        </div>

        {loading ? <Spinner /> : data.items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('admin.audit.empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('admin.audit.time')}</th>
                    <th className="px-5 py-3">{t('admin.audit.col.username')}</th>
                    <th className="px-5 py-3">{t('admin.audit.col.result')}</th>
                    <th className="px-5 py-3">{t('admin.audit.col.ip')}</th>
                    <th className="px-5 py-3">{t('admin.audit.col.device')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((r) => (
                    <tr key={r.id} className={r.success ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{formatDateTime(r.created_at)}</td>
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-slate-800">{r.username}</span>
                        {r.full_name && <span className="block text-xs text-slate-400">{r.full_name}</span>}
                      </td>
                      <td className="px-5 py-2.5"><Badge tone={r.success ? 'green' : 'red'}>{r.success ? t('admin.audit.ok') : t('admin.audit.failed')}</Badge></td>
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{r.ip_address || '-'}</td>
                      <td className="max-w-xs truncate px-5 py-2.5 text-xs text-slate-400" title={r.user_agent}>{r.user_agent || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page || page} pages={data.pages} total={data.total} limit={LIMIT} onChange={(p) => { setLoading(true); setPage(p); }} />
          </>
        )}
      </Card>
    </div>
  );
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('activity');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.audit')}</h1>
        <p className="text-slate-500">{t('admin.audit.subtitle')}</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {['activity', 'logins'].map((k) => (
          <button
            key={k} onClick={() => setTab(k)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`admin.audit.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'activity' ? <ActivityLog /> : <LoginLog />}
    </div>
  );
}