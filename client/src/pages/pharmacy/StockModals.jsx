import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { pharmacyApi } from '../../api/pharmacy.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { expiryState, FORMS, medLabel, num } from '../../utils/pharmacy';
import { addDays, formatDate, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const fieldErrors = (err) => {
  const list = err.response?.data?.errors;
  return Array.isArray(list) ? Object.fromEntries(list.map((x) => [x.field, x.message])) : null;
};

// ---------------- Receive stock ----------------
export function ReceiveModal({ med, onClose, onSaved }) {
  const { t } = useTranslation();
  const [meds, setMeds] = useState([]);
  const [form, setForm] = useState({ medication_id: med ? String(med.id) : '', batch_no: '', expiry_date: '', quantity: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pharmacyApi.stock({}).then((r) => setMeds(r.data.data.items.filter((x) => x.is_active))).catch(() => {});
  }, []);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async () => {
    const er = {};
    const req = t('form.required');
    if (!form.medication_id) er.medication_id = req;
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/.test(form.batch_no.trim())) er.batch_no = t('pharm.recv.batchHint');
    if (!form.expiry_date) er.expiry_date = req;
    else if (form.expiry_date <= todayISO()) er.expiry_date = t('pharm.recv.expiry');
    if (!(Number(form.quantity) >= 1) || !Number.isInteger(Number(form.quantity))) er.quantity = req;
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const res = await pharmacyApi.receive({ ...form, medication_id: Number(form.medication_id), quantity: Number(form.quantity) });
      toast.success(res.data.data.topped_up ? t('pharm.recv.toppedUp') : t('pharm.recv.saved'));
      onSaved();
    } catch (err) {
      const mapped = fieldErrors(err);
      if (mapped) setErrors(mapped); else toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} title={t('pharm.recv.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('pharm.recv.medication')} required placeholder={t('pharm.recv.select')}
          options={meds.map((m) => ({ value: m.id, label: `${medLabel(m)} (${m.form})` }))}
          value={form.medication_id} onChange={set('medication_id')} error={errors.medication_id}
        />
        <Input label={t('pharm.recv.batchNo')} required value={form.batch_no} onChange={set('batch_no')} error={errors.batch_no} hint={t('pharm.recv.batchHint')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('pharm.recv.expiry')} required type="date" min={addDays(todayISO(), 1)} value={form.expiry_date} onChange={set('expiry_date')} error={errors.expiry_date} />
          <Input label={t('pharm.recv.quantity')} required type="number" min="1" value={form.quantity} onChange={set('quantity')} error={errors.quantity} />
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Add / edit medication ----------------
export function MedicationModal({ med, onClose, onSaved }) {
  const { t } = useTranslation();
  const isNew = !med;
  const [form, setForm] = useState({
    generic_name: med?.generic_name || '', brand_name: med?.brand_name || '', form: med?.form || '',
    strength: med?.strength || '', unit_price: med?.unit_price ?? '', reorder_level: med?.reorder_level ?? 50,
    is_controlled: !!med?.is_controlled, is_active: med ? !!med.is_active : true,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async () => {
    const er = {};
    const req = t('form.required');
    if (!form.generic_name.trim()) er.generic_name = req;
    if (!form.form) er.form = req;
    if (form.unit_price === '' || Number(form.unit_price) < 0) er.unit_price = req;
    if (form.reorder_level === '' || Number(form.reorder_level) < 0) er.reorder_level = req;
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      if (isNew) await pharmacyApi.createMedication(form);
      else await pharmacyApi.updateMedication(med.id, form);
      toast.success(t('pharm.med.saved'));
      onSaved();
    } catch (err) {
      const mapped = fieldErrors(err);
      if (mapped) setErrors(mapped); else toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="lg" title={isNew ? t('pharm.s.add') : t('pharm.s.edit')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('pharm.med.name')} required value={form.generic_name} onChange={set('generic_name')} error={errors.generic_name} />
        <Input label={t('pharm.med.brand')} value={form.brand_name} onChange={set('brand_name')} />
        <Select label={t('pharm.med.form')} required placeholder={t('form.select')} options={FORMS.map((f) => ({ value: f, label: f }))} value={form.form} onChange={set('form')} error={errors.form} />
        <Input label={t('pharm.med.strength')} value={form.strength} onChange={set('strength')} placeholder="500 mg" />
        <Input label={t('pharm.med.price')} required type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} error={errors.unit_price} />
        <Input label={t('pharm.med.reorder')} required type="number" min="0" value={form.reorder_level} onChange={set('reorder_level')} error={errors.reorder_level} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.is_controlled} onChange={(e) => setForm({ ...form, is_controlled: e.target.checked })} />
          {t('pharm.med.controlled')}
        </label>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            {t('pharm.med.active')}
          </label>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Write off ----------------
function AdjustModal({ batch, med, onClose, onSaved }) {
  const { t } = useTranslation();
  const expired = expiryState(batch.expiry_date).key === 'expired';
  const [form, setForm] = useState({
    reason_type: expired ? 'expired' : 'damaged',
    quantity: String(expired ? batch.quantity_available : ''),
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async () => {
    const er = {};
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty < 1) er.quantity = t('form.required');
    else if (qty > batch.quantity_available) er.quantity = `${t('pharm.adj.max')}: ${batch.quantity_available}`;
    if (['lost', 'count_correction'].includes(form.reason_type) && form.note.trim().length < 3) er.note = t('pharm.adj.noteHint');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      await pharmacyApi.adjust(batch.id, { ...form, quantity: qty });
      toast.success(t('pharm.adj.saved'));
      onSaved();
    } catch (err) {
      const mapped = fieldErrors(err);
      if (mapped) setErrors(mapped); else toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const reasons = ['damaged', 'expired', 'lost', 'count_correction'].map((r) => ({ value: r, label: t(`pharm.adj.${r}`) }));

  return (
    <Modal
      open onClose={onClose} size="sm" title={t('pharm.adj.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button variant="danger" onClick={save} loading={busy}>{t('pharm.adj.action')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 p-3 text-sm">
          <strong className="text-slate-800">{medLabel(med)}</strong><br />
          {t('pharm.bm.batchNo')}: <span className="font-mono">{batch.batch_no}</span> · {t('pharm.adj.max')}: <strong>{num(batch.quantity_available)}</strong>
        </p>
        <Select label={t('pharm.adj.reason')} options={reasons} value={form.reason_type} onChange={set('reason_type')} />
        <Input label={t('pharm.adj.quantity')} required type="number" min="1" max={batch.quantity_available} value={form.quantity} onChange={set('quantity')} error={errors.quantity} />
        <Input label={t('pharm.adj.note')} value={form.note} onChange={set('note')} error={errors.note} hint={t('pharm.adj.noteHint')} />
      </div>
    </Modal>
  );
}

// ---------------- Batches of one medication ----------------
export function BatchesModal({ med, manage, onClose, onChanged }) {
  const { t } = useTranslation();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(null);

  const load = useCallback(() => {
    pharmacyApi.batches(med.id)
      .then((res) => setBatches(res.data.data.batches))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  }, [med.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <Modal open onClose={onClose} size="lg" title={`${t('pharm.bm.title')}: ${medLabel(med)}`}>
      {loading ? <Spinner /> : batches.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('pharm.bm.none')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">{t('pharm.bm.batchNo')}</th>
                <th className="px-3 py-2">{t('pharm.bm.expiry')}</th>
                <th className="px-3 py-2">{t('pharm.bm.received')}</th>
                <th className="px-3 py-2">{t('pharm.bm.available')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => {
                const ex = expiryState(b.expiry_date);
                return (
                  <tr key={b.id} className={ex.key === 'expired' ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2 font-mono text-xs">{b.batch_no}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDate(b.expiry_date)}{' '}
                      {ex.key === 'expired'
                        ? <Badge tone="red">{t('pharm.s.expiredLabel')}</Badge>
                        : ex.key === 'soon' && <Badge tone="amber">{t('pharm.s.daysLeft', { n: ex.days })}</Badge>}
                    </td>
                    <td className="px-3 py-2">{num(b.quantity_received)}</td>
                    <td className="px-3 py-2 font-semibold">{num(b.quantity_available)}</td>
                    <td className="px-3 py-2 text-right">
                      {manage && b.quantity_available > 0 && (
                        <button onClick={() => setAdjusting(b)} className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">
                          {t('pharm.adj.action')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adjusting && (
        <AdjustModal
          batch={adjusting} med={med} onClose={() => setAdjusting(null)}
          onSaved={() => { setAdjusting(null); load(); onChanged(); }}
        />
      )}
    </Modal>
  );
}