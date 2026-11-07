import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ClipboardCheck, FlaskConical, Microscope, Search, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import { labApi } from '../../api/lab.api';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import ResultEntry from './ResultEntry';
import LabCatalog from './LabCatalog';
import { FLAG_TONE, LAB_TONE } from '../../utils/constants';
import { formatDuration, isNumericTest, minutesSince, REJECT_REASONS } from '../../utils/lab';
import { calcAge, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const TABS = ['active', 'ordered', 'collected', 'processing', 'resulted', 'verified', 'rejected'];
const ACTIVE = ['ordered', 'collected', 'processing', 'resulted'];

const btn = 'rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50';

export default function LabQueue() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { can } = usePermission();

  const [view, setView] = useState('active');
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ items: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const [resultFor, setResultFor] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [verifyFor, setVerifyFor] = useState(null);
  const [modalBusy, setModalBusy] = useState(false);

  const showCatalog = view === 'catalog';

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (showCatalog) return undefined;
    let off = false;
    labApi.orders({ status: view, date, search: query })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [view, date, query, tick, showCatalog, t]);

  const changeView = (v) => { setLoading(true); setView(v); };
  const s = data.summary;

  const collect = async (o) => {
    setBusyId(o.id);
    try {
      const res = await labApi.collect(o.id);
      toast.success(`${t('lab.msg.collected')}: ${res.data.data.barcode}`);
      reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusyId(null); }
  };

  const start = async (o) => {
    setBusyId(o.id);
    try {
      await labApi.start(o.id);
      toast.success(t('lab.msg.started'));
      reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusyId(null); }
  };

  const doVerify = async () => {
    setModalBusy(true);
    try {
      const res = await labApi.verify(verifyFor.id);
      if (res.data.data.critical) toast(t('lab.msg.criticalVerified'), { icon: '⚠️', duration: 10000 });
      else toast.success(t('lab.msg.verified'));
      setVerifyFor(null);
      reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setModalBusy(false); }
  };

  const doReject = async () => {
    if (reason.trim().length < 3) return setReasonError(t('lab.rejectModal.required'));
    setModalBusy(true);
    try {
      await labApi.reject(rejectFor.id, reason);
      toast.success(t('lab.msg.rejected'));
      setRejectFor(null);
      reload();
    } catch (err) { setReasonError(errMsg(err)); } finally { setModalBusy(false); }
  };

  const resultCell = (o) => {
    if (o.status === 'rejected') return <span className="text-xs text-red-600">{o.reject_reason}</span>;
    if (o.result_value === null) return <span className="text-slate-400">-</span>;
    const qual = !isNumericTest(o);
    return (
      <div>
        <span className="font-semibold text-slate-800">{o.result_value}</span>{' '}
        <span className="text-xs text-slate-500">{o.unit || ''}</span>
        {o.result_flag && (
          <span className="ml-1.5">
            <Badge tone={FLAG_TONE[o.result_flag]}>
              {qual && o.result_flag !== 'critical' ? t(`lab.qualFlag.${o.result_flag}`) : t(`lab.flag.${o.result_flag}`)}
            </Badge>
          </span>
        )}
        {o.ref_text && <p className="text-xs text-slate-400">{t('lab.catalog.reference')}: {o.ref_text}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.lab')}</h1>
        <p className="text-slate-500">{t('lab.subtitle')}</p>
      </div>

      {!showCatalog && s && (
        <>
          {s.critical > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-semibold">{t('lab.summary.criticalAlert', { n: s.critical })}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={FlaskConical} label={t('lab.summary.toCollect')} value={s.ordered} color="amber" />
            <StatCard icon={Microscope} label={t('lab.summary.inLab')} value={s.in_lab} color="blue" />
            <StatCard icon={ClipboardCheck} label={t('lab.summary.toVerify')} value={s.resulted} color="violet" />
            <StatCard
              icon={Timer} label={`${t('lab.summary.verifiedToday')}: ${s.verified_today}`} color="teal"
              value={s.avg_tat === null ? '-' : `${s.avg_tat} ${t('lab.summary.min')}`}
            />
          </div>
        </>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {[...TABS, ...(can('lab.manage_catalog') ? ['catalog'] : [])].map((k) => (
          <button
            key={k} onClick={() => changeView(k)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              view === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`lab.tab.${k}`)}
          </button>
        ))}
      </div>

      {showCatalog ? (
        <LabCatalog />
      ) : (
        <Card className="overflow-hidden !p-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
            <div className="relative sm:w-80">
              <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('lab.searchPh')}
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
            <span className="text-xs text-slate-400 sm:ml-auto">{t('lab.autoRefresh')}</span>
          </div>

          {loading ? (
            <Spinner />
          ) : data.items.length === 0 ? (
            <p className="py-16 text-center text-slate-500">{t('lab.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('lab.col.order')}</th>
                    <th className="px-5 py-3">{t('lab.col.patient')}</th>
                    <th className="px-5 py-3">{t('lab.col.test')}</th>
                    <th className="px-5 py-3">{t('lab.col.ordered')}</th>
                    <th className="px-5 py-3">{t('lab.col.status')}</th>
                    <th className="px-5 py-3">{t('lab.col.result')}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((o) => {
                    const critical = o.status === 'resulted' && o.result_flag === 'critical';
                    const busy = busyId === o.id;
                    return (
                      <tr key={o.id} className={critical ? 'bg-red-50' : 'hover:bg-slate-50'}>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-600">{o.barcode || `#${o.id}`}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{o.patient_name}</p>
                          <p className="text-xs text-slate-400">
                            <span className="font-mono">{o.mrn}</span> · {calcAge(o.date_of_birth)} · {t(`patients.${o.gender}`)}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{o.test_name}</span>
                            {o.priority === 'urgent' && <Badge tone="red">{t('lab.priority.urgent')}</Badge>}
                          </div>
                          <p className="text-xs text-slate-400">{o.specimen || '-'}</p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {String(o.created_at).slice(11, 16)}
                          <p className="text-xs text-slate-400">{o.ordered_by_name}</p>
                          {ACTIVE.includes(o.status) && (
                            <p className={`text-xs ${o.priority === 'urgent' ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
                              {formatDuration(minutesSince(o.created_at))} {t('lab.waiting')}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3"><Badge tone={LAB_TONE[o.status]}>{t(`lab.status.${o.status}`)}</Badge></td>
                        <td className="px-5 py-3">{resultCell(o)}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {o.status === 'ordered' && can('lab.collect') && (
                              <button disabled={busy} onClick={() => collect(o)} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}>
                                {t('lab.act.collect')}
                              </button>
                            )}
                            {o.status === 'collected' && can('lab.enter_result') && (
                              <button disabled={busy} onClick={() => start(o)} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                                {t('lab.act.start')}
                              </button>
                            )}
                            {['collected', 'processing'].includes(o.status) && can('lab.enter_result') && (
                              <button onClick={() => setResultFor(o)} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}>
                                {t('lab.act.result')}
                              </button>
                            )}
                            {o.status === 'resulted' && can('lab.enter_result') && (
                              <button onClick={() => setResultFor(o)} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                                {t('lab.act.edit')}
                              </button>
                            )}
                            {o.status === 'resulted' && can('lab.verify') && (
                              <button onClick={() => setVerifyFor(o)} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}>
                                {t('lab.act.verify')}
                              </button>
                            )}
                            {['ordered', 'collected', 'processing'].includes(o.status) && (can('lab.collect') || can('lab.enter_result')) && (
                              <button
                                onClick={() => { setRejectFor(o); setReason(''); setReasonError(''); }}
                                className={`${btn} bg-red-50 text-red-600 hover:bg-red-100`}
                              >
                                {t('lab.act.reject')}
                              </button>
                            )}
                            {can('encounters.read') && (
                              <Link to={`/opd/${o.encounter_id}`} className={`${btn} text-teal-700 hover:underline`}>OPD</Link>
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
      )}

      {resultFor && (
        <ResultEntry order={resultFor} onClose={() => setResultFor(null)} onSaved={() => { setResultFor(null); reload(); }} />
      )}

      <Modal
        open={!!verifyFor} onClose={() => setVerifyFor(null)} title={t('lab.verifyModal.title')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVerifyFor(null)}>{t('form.cancel')}</Button>
            <Button onClick={doVerify} loading={modalBusy}>{t('lab.act.verify')}</Button>
          </>
        }
      >
        {verifyFor && (
          <div className="space-y-3 text-sm text-slate-600">
            <p className="rounded-lg bg-slate-50 p-3">
              <strong className="text-slate-800">{verifyFor.test_name}</strong> · {verifyFor.patient_name}<br />
              {t('lab.col.result')}: <strong>{verifyFor.result_value}</strong> {verifyFor.unit || ''}{' '}
              {verifyFor.result_flag && <Badge tone={FLAG_TONE[verifyFor.result_flag]}>{t(`lab.flag.${verifyFor.result_flag}`)}</Badge>}
            </p>
            <p>{t('lab.verifyModal.msg')}</p>
            {verifyFor.resulted_by === user.id && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{t('lab.verifyModal.self')}</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejectFor} onClose={() => setRejectFor(null)} title={t('lab.rejectModal.title')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectFor(null)}>{t('form.cancel')}</Button>
            <Button variant="danger" onClick={doReject} loading={modalBusy}>{t('lab.rejectModal.confirm')}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{rejectFor?.test_name} · {rejectFor?.patient_name}</p>
          <Input
            label={t('lab.rejectModal.reason')} required value={reason} list="reject-reasons" error={reasonError}
            placeholder={t('lab.rejectModal.reasonPh')}
            onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
          />
          <datalist id="reject-reasons">{REJECT_REASONS.map((r) => <option key={r} value={r} />)}</datalist>
          <p className="text-xs text-slate-500">{t('lab.rejectModal.hint')}</p>
        </div>
      </Modal>
    </div>
  );
}