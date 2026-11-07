import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Pill, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { encountersApi } from '../../api/encounters.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { FREQUENCIES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const RX_TONE = { pending: 'amber', partially_dispensed: 'blue', dispensed: 'green', cancelled: 'red' };
const newRow = () => ({ medication_id: '', dosage: '', frequency: '', duration_days: '', quantity: '', instructions: '', qtyTouched: false });
const selectCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

export default function PrescriptionPanel({ enc, canPrescribe, onChanged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [meds, setMeds] = useState([]);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [rows, setRows] = useState([newRow()]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoadingMeds(true);
    encountersApi.medications()
      .then((r) => setMeds(r.data.data))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoadingMeds(false));
  }, [open]);

  const openNew = () => { setRows([newRow()]); setNotes(''); setConflicts(null); setOpen(true); };

  const updateRow = (i, key, value) => {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, [key]: value };
      if (key === 'quantity') next.qtyTouched = true;
      if ((key === 'frequency' || key === 'duration_days') && !next.qtyTouched) {
        const f = FREQUENCIES.find((x) => x.value === next.frequency);
        const days = Number(next.duration_days);
        if (f && f.perDay > 0 && days > 0) next.quantity = String(f.perDay * days);
      }
      return next;
    }));
  };

  const submit = async (override = false) => {
    const incomplete = rows.some((r) => !r.medication_id || !r.dosage.trim() || !r.frequency || !r.duration_days || !r.quantity);
    if (incomplete) return toast.error(t('consult.rx.incomplete'));

    setBusy(true);
    try {
      await encountersApi.prescribe(enc.id, {
        items: rows.map(({ qtyTouched, ...r }) => ({
          ...r, medication_id: Number(r.medication_id), duration_days: Number(r.duration_days), quantity: Number(r.quantity),
        })),
        notes,
        override,
      });
      toast.success(t('consult.rx.saved'));
      setOpen(false);
      setConflicts(null);
      await onChanged();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.errors?.conflicts) {
        setConflicts(err.response.data.errors.conflicts);
      } else {
        toast.error(errMsg(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelRx = async (rx) => {
    try {
      await encountersApi.cancelRx(enc.id, rx.id);
      toast.success(t('consult.rx.cancelled'));
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Card
      title={t('consult.rx.title')}
      action={canPrescribe && (
        <Button className="!px-3 !py-1.5" onClick={openNew}>
          <Pill className="h-4 w-4" /> {t('consult.rx.add')}
        </Button>
      )}
    >
      {enc.prescriptions.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">{t('consult.rx.none')}</p>
      ) : (
        <div className="space-y-4">
          {enc.prescriptions.map((rx) => (
            <div key={rx.id} className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Badge tone={RX_TONE[rx.status]}>{t(`consult.rx.status.${rx.status}`)}</Badge>
                  {formatDateTime(rx.created_at)} · {rx.doctor_name}
                </div>
                {canPrescribe && rx.status === 'pending' && (
                  <button onClick={() => cancelRx(rx)} className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">
                    {t('consult.rx.cancelRx')}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-slate-100 px-4">
                {rx.items.map((it) => (
                  <li key={it.id} className="py-2.5 text-sm">
                    <p className="font-medium text-slate-800">
                      {it.generic_name} {it.strength} <span className="font-normal text-slate-500">({it.form})</span>
                    </p>
                    <p className="text-slate-600">
                      {it.dosage} · {it.frequency} · {it.duration_days} {t('consult.rx.daysUnit')} · {t('consult.rx.quantity')} {it.quantity}
                      {it.quantity_dispensed > 0 && <span className="text-slate-400"> ({it.quantity_dispensed} {t('consult.rx.dispensed')})</span>}
                    </p>
                    {it.instructions && <p className="text-xs text-slate-500">{it.instructions}</p>}
                  </li>
                ))}
              </ul>
              {rx.notes && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{rx.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Write prescription */}
      <Modal
        open={open && !conflicts} onClose={() => setOpen(false)} title={t('consult.rx.addTitle')} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('form.cancel')}</Button>
            <Button onClick={() => submit(false)} loading={busy}>{t('form.save')}</Button>
          </>
        }
      >
        {loadingMeds ? <Spinner /> : (
          <div className="space-y-4">
            {rows.map((r, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('consult.rx.medication')}</label>
                    <select className={selectCls} value={r.medication_id} onChange={(e) => updateRow(i, 'medication_id', e.target.value)}>
                      <option value="">{t('consult.rx.selectMed')}</option>
                      {meds.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.generic_name} {m.strength} ({m.form}) - {Number(m.stock) > 0 ? `${m.stock} ${t('consult.rx.stock')}` : t('consult.rx.outOfStock')}
                        </option>
                      ))}
                    </select>
                  </div>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="mt-7 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Input label={t('consult.rx.dosage')} value={r.dosage} placeholder={t('consult.rx.dosagePh')} onChange={(e) => updateRow(i, 'dosage', e.target.value)} />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('consult.rx.frequency')}</label>
                    <select className={selectCls} value={r.frequency} onChange={(e) => updateRow(i, 'frequency', e.target.value)}>
                      <option value="">{t('form.select')}</option>
                      {FREQUENCIES.map((f) => <option key={f.code} value={f.value}>{f.code} - {t(`consult.rx.freq.${f.code}`)}</option>)}
                    </select>
                  </div>
                  <Input label={t('consult.rx.duration')} type="number" min="1" max="365" value={r.duration_days} onChange={(e) => updateRow(i, 'duration_days', e.target.value)} />
                  <Input label={t('consult.rx.quantity')} type="number" min="1" value={r.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)} />
                </div>
                <Input label={t('consult.rx.instructions')} value={r.instructions} placeholder={t('consult.rx.instructionsPh')} onChange={(e) => updateRow(i, 'instructions', e.target.value)} />
              </div>
            ))}
            {rows.length < 10 && (
              <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])} className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline">
                <Plus className="h-4 w-4" /> {t('consult.rx.addRow')}
              </button>
            )}
            <Input label={t('consult.rx.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
      </Modal>

      {/* Allergy warning */}
      <Modal
        open={!!conflicts} onClose={() => setConflicts(null)} title={t('consult.rx.allergyTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConflicts(null)}>{t('form.back')}</Button>
            <Button variant="danger" onClick={() => submit(true)} loading={busy}>{t('consult.rx.anyway')}</Button>
          </>
        }
      >
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{t('consult.rx.allergyMsg')}</p>
        </div>
        <ul className="space-y-2">
          {conflicts?.map((c, i) => (
            <li key={i} className="rounded-lg border border-red-200 p-3 text-sm">
              <strong>{c.medication}</strong> ↔ {c.allergen} <Badge tone={c.severity === 'severe' ? 'red' : 'amber'}>{t(`patients.sev.${c.severity}`)}</Badge>
            </li>
          ))}
        </ul>
      </Modal>
    </Card>
  );
}