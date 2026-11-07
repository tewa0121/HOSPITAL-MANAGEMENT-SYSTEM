import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { pharmacyApi } from '../../api/pharmacy.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { medLabel, RX_TONE } from '../../utils/pharmacy';
import { calcAge, formatDate, formatDateTime, fullName } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const SEV_TONE = { mild: 'slate', moderate: 'amber', severe: 'red' };

export default function Dispense() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();

  const [rx, setRx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await pharmacyApi.prescription(id);
      setRx(res.data.data);
    } catch (err) {
      toast.error(errMsg(err, 'Error'));
      navigate('/pharmacy', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // sensible default: dispense everything that is remaining and in stock
  useEffect(() => {
    if (!rx) return;
    const q = {};
    rx.items.forEach((it) => {
      q[it.id] = it.remaining > 0 && it.available > 0 ? String(Math.min(it.remaining, it.available)) : '0';
    });
    setQty(q);
  }, [rx]);

  if (loading || !rx) return <Spinner />;

  const p = rx.patient;
  const active = ['pending', 'partially_dispensed'].includes(rx.status);
  const canDispense = active && can('prescriptions.dispense');
  const severe = rx.allergies.filter((a) => a.severity === 'severe');

  const rowError = (it) => {
    const n = Number(qty[it.id] || 0);
    if (!Number.isInteger(n) || n < 0) return t('form.required');
    if (n > it.remaining) return t('pharm.d.overRemaining');
    if (n > it.available) return t('pharm.d.overStock');
    return '';
  };

  const selected = rx.items.filter((it) => Number(qty[it.id]) > 0);
  const hasErrors = rx.items.some((it) => rowError(it));

  const submit = async (override = false) => {
    if (override && reason.trim().length < 3) return setReasonError(t('pharm.d.overrideRequired'));
    setBusy(true);
    try {
      await pharmacyApi.dispense(id, {
        items: selected.map((it) => ({ item_id: it.id, quantity: Number(qty[it.id]) })),
        override,
        override_reason: override ? reason : undefined,
      });
      toast.success(t('pharm.d.success'));
      setConfirmOpen(false);
      setConflicts(null);
      setReason('');
      await load();
    } catch (err) {
      const found = err.response?.data?.errors?.conflicts;
      if (err.response?.status === 409 && found) {
        setConfirmOpen(false);
        setConflicts(found);
      } else {
        toast.error(errMsg(err));
        setConfirmOpen(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const openConfirm = () => {
    if (!selected.length) return toast.error(t('pharm.d.nothingSelected'));
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      <Link to="/pharmacy" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700">
        <ArrowLeft className="h-4 w-4" /> {t('pharm.d.back')}
      </Link>

      {severe.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{t('pharm.d.severeAlert')}: {severe.map((a) => a.allergen).join(', ')}</p>
        </div>
      )}
      {rx.conflicts.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {t('pharm.d.conflictBanner')}
          </p>
          <ul className="mt-1 list-disc pl-9 text-sm">
            {rx.conflicts.map((c, i) => <li key={i}>{c.medication} ↔ {c.allergen}</li>)}
          </ul>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-lg font-bold text-white">
              {`${p.first_name[0] || ''}${p.father_name[0] || ''}`.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{fullName(p)}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{p.mrn}</span>
                <span>{calcAge(p.date_of_birth)} · {t(`patients.${p.gender}`)}</span>
                {p.blood_group !== 'unknown' && <Badge tone="red">{p.blood_group}</Badge>}
                <Badge tone={RX_TONE[rx.status]}>{t(`pharm.status.${rx.status}`)}</Badge>
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-500 lg:text-right">
            <p>{t('pharm.d.doctor')}: <strong className="text-slate-800">{rx.doctor_name}</strong></p>
            <p>{t('pharm.d.time')}: {formatDateTime(rx.created_at)}</p>
          </div>
        </div>

        {rx.status === 'cancelled' && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{t('pharm.d.cancelledHint')}</p>}
        {rx.status === 'dispensed' && <p className="mt-4 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">{t('pharm.d.completeHint')}</p>}
        {active && !canDispense && <p className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">{t('pharm.d.readOnlyHint')}</p>}
        {rx.notes && <p className="mt-4 text-sm text-slate-600">{t('pharm.d.notes')}: {rx.notes}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden" title={t('pharm.d.items')}>
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('pharm.d.medication')}</th>
                    <th className="px-5 py-3">{t('pharm.d.prescribed')}</th>
                    <th className="px-5 py-3">{t('pharm.d.dispensed')}</th>
                    {canDispense && <th className="px-5 py-3">{t('pharm.d.inStock')}</th>}
                    {canDispense && <th className="px-5 py-3">{t('pharm.d.dispenseNow')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rx.items.map((it) => {
                    const err = canDispense && it.remaining > 0 ? rowError(it) : '';
                    const next = it.batches[0];
                    return (
                      <tr key={it.id} className="align-top">
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-800">{medLabel(it)}</span>
                            <span className="text-xs text-slate-400">({it.form})</span>
                            {it.is_controlled && <Badge tone="red">{t('pharm.d.controlled')}</Badge>}
                          </div>
                          <p className="text-xs text-slate-500">
                            {it.dosage} · {it.frequency} · {it.duration_days} {t('consult.rx.daysUnit')}
                          </p>
                          {it.instructions && <p className="text-xs text-slate-400">{it.instructions}</p>}
                        </td>
                        <td className="px-5 py-3 font-medium">{it.quantity}</td>
                        <td className="px-5 py-3">
                          {it.quantity_dispensed}
                          {it.remaining === 0 && <span className="ml-1.5"><Badge tone="green">{t('pharm.d.done')}</Badge></span>}
                        </td>
                        {canDispense && (
                          <td className="px-5 py-3">
                            {it.remaining === 0 ? '-' : it.available > 0 ? (
                              <>
                                <span className={it.available < it.remaining ? 'font-semibold text-amber-600' : 'font-medium'}>{it.available}</span>
                                {next && (
                                  <p className="text-xs text-slate-400">
                                    {t('pharm.d.nextBatch')}: {next.batch_no} · {formatDate(next.expiry_date)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <Badge tone="red">{t('pharm.d.noStock')}</Badge>
                            )}
                          </td>
                        )}
                        {canDispense && (
                          <td className="px-5 py-3">
                            {it.remaining === 0 ? '-' : (
                              <>
                                <input
                                  type="number" min="0" max={it.remaining} value={qty[it.id] ?? ''}
                                  onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))}
                                  className={`w-24 rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 ${
                                    err ? 'border-red-400 focus:ring-red-500/20' : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
                                  }`}
                                />
                                {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                                <p className="mt-1 text-xs text-slate-400">{t('pharm.d.remaining')}: {it.remaining}</p>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {canDispense && (
              <div className="mt-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500">{t('pharm.d.fefo')}</p>
                <Button onClick={openConfirm} disabled={hasErrors || !selected.length}>
                  <PackageCheck className="h-4 w-4" /> {t('pharm.d.action')}
                </Button>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden" title={t('pharm.d.history')}>
            {rx.history.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">{t('pharm.d.historyEmpty')}</p>
            ) : (
              <div className="-mx-5 -mb-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t('pharm.d.medication')}</th>
                      <th className="px-5 py-3">{t('pharm.d.qty')}</th>
                      <th className="px-5 py-3">{t('pharm.d.batch')}</th>
                      <th className="px-5 py-3">{t('pharm.d.expiry')}</th>
                      <th className="px-5 py-3">{t('pharm.d.by')}</th>
                      <th className="px-5 py-3">{t('pharm.d.when')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rx.history.map((h) => (
                      <tr key={h.id}>
                        <td className="px-5 py-2.5 font-medium text-slate-800">{medLabel(h)}</td>
                        <td className="px-5 py-2.5">{h.quantity}</td>
                        <td className="px-5 py-2.5 font-mono text-xs">{h.batch_no}</td>
                        <td className="whitespace-nowrap px-5 py-2.5">{formatDate(h.expiry_date)}</td>
                        <td className="px-5 py-2.5">{h.dispensed_by_name}</td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{formatDateTime(h.dispensed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t('pharm.d.allergies')}>
            {rx.allergies.length === 0 ? (
              <p className="text-sm text-slate-500">{t('pharm.d.noAllergies')}</p>
            ) : (
              <ul className="space-y-2">
                {rx.allergies.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">{a.allergen}</span>
                    <Badge tone={SEV_TONE[a.severity]}>{t(`patients.sev.${a.severity}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Confirm */}
      <Modal
        open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('pharm.d.confirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>{t('form.cancel')}</Button>
            <Button onClick={() => submit(false)} loading={busy}>{t('pharm.d.action')}</Button>
          </>
        }
      >
        <ul className="mb-4 space-y-2">
          {selected.map((it) => (
            <li key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{medLabel(it)}</span>
              <span className="font-semibold">× {qty[it.id]}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600">{t('pharm.d.confirmMsg')}</p>
      </Modal>

      {/* Allergy override */}
      <Modal
        open={!!conflicts} onClose={() => setConflicts(null)} title={t('pharm.d.overrideTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConflicts(null)}>{t('form.back')}</Button>
            <Button variant="danger" onClick={() => submit(true)} loading={busy}>{t('pharm.d.anyway')}</Button>
          </>
        }
      >
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{t('pharm.d.overrideMsg')}</p>
        </div>
        <ul className="mb-4 space-y-2">
          {conflicts?.map((c, i) => (
            <li key={i} className="rounded-lg border border-red-200 p-3 text-sm">
              <strong>{c.medication}</strong> ↔ {c.allergen}{' '}
              <Badge tone={c.severity === 'severe' ? 'red' : 'amber'}>{t(`patients.sev.${c.severity}`)}</Badge>
            </li>
          ))}
        </ul>
        <Input
          label={t('pharm.d.overrideReason')} required value={reason} error={reasonError}
          placeholder={t('pharm.d.overrideReasonPh')}
          onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
        />
      </Modal>
    </div>
  );
}