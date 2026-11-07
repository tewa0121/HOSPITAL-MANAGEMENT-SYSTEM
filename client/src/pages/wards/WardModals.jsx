import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { wardsApi } from '../../api/wards.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { BED_TONE, wardName } from '../../utils/wards';
import { isMoney } from '../../utils/billing';
import { calcAge, formatDateTime } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const fieldErrors = (err) => {
  const list = err.response?.data?.errors;
  return Array.isArray(list) ? Object.fromEntries(list.map((x) => [x.field, x.message])) : null;
};

// ---------------- One bed: details and status actions ----------------
export function BedModal({ bed, ward, onClose, onChanged }) {
  const { t, i18n } = useTranslation();
  const { can } = usePermission();
  const [busy, setBusy] = useState(false);

  const change = async (status) => {
    setBusy(true);
    try {
      await wardsApi.bedStatus(bed.id, status);
      toast.success(t('ward.bed.changed'));
      onChanged();
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const canStatus = can('wards.bed_status') && bed.status !== 'occupied';

  return (
    <Modal open onClose={onClose} size="sm" title={`${t('nav.wards')}: ${bed.bed_number}`}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <span className="text-slate-500">{t('ward.bed.ward')}: <strong className="text-slate-800">{wardName(ward, i18n.language)}</strong></span>
          <Badge tone={BED_TONE[bed.status]}>{t(`ward.status.${bed.status}`)}</Badge>
        </div>

        {bed.status === 'occupied' ? (
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">{bed.patient_name}</p>
            <p className="text-slate-500"><span className="font-mono text-xs">{bed.mrn}</span> · {calcAge(bed.date_of_birth)} · {t(`patients.${bed.gender}`)}</p>
            <p className="text-slate-500">{t('ward.bed.doctor')}: {bed.doctor_name}</p>
            <p className="text-slate-500">{t('ward.bed.since')}: {formatDateTime(bed.admitted_at)}</p>
            {can('admissions.read') && (
              <Link to={`/admissions/${bed.admission_id}`} className="inline-block pt-1 font-medium text-teal-700 hover:underline">{t('ward.bed.open')}</Link>
            )}
            <p className="pt-2 text-xs text-slate-400">{t('ward.bed.occupiedNote')}</p>
          </div>
        ) : (
          <p className="text-slate-500">{t('ward.bed.free')}</p>
        )}

        {canStatus && (
          <div className="flex flex-wrap gap-2 pt-1">
            {bed.status === 'cleaning' && <Button loading={busy} onClick={() => change('available')}>{t('ward.bed.markClean')}</Button>}
            {bed.status === 'maintenance' && <Button loading={busy} onClick={() => change('available')}>{t('ward.bed.setAvailable')}</Button>}
            {bed.status !== 'maintenance' && <Button variant="secondary" loading={busy} onClick={() => change('maintenance')}>{t('ward.bed.setMaintenance')}</Button>}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Add or edit a ward ----------------
export function WardModal({ ward, onClose, onSaved }) {
  const { t } = useTranslation();
  const isNew = !ward;
  const [form, setForm] = useState({
    code: ward?.code || '', name: ward?.name || '', name_am: ward?.name_am || '',
    daily_rate: ward?.daily_rate ?? '', beds: 0, is_active: ward ? ward.is_active : true,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async () => {
    const er = {};
    const req = t('form.required');
    if (isNew && !/^[A-Za-z0-9]{2,10}$/.test(form.code.trim())) er.code = t('ward.w.codeHint');
    if (!form.name.trim()) er.name = req;
    if (!isMoney(form.daily_rate)) er.daily_rate = t('ward.w.invalidRate');
    if (isNew && (form.beds === '' || Number(form.beds) < 0 || Number(form.beds) > 50)) er.beds = '0-50';
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const payload = { ...form, daily_rate: Number(form.daily_rate), beds: Number(form.beds || 0) };
      if (isNew) await wardsApi.createWard(payload);
      else await wardsApi.updateWard(ward.id, payload);
      toast.success(t('ward.w.saved'));
      onSaved();
    } catch (err) {
      const mapped = fieldErrors(err);
      if (mapped) setErrors(mapped); else toast.error(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="lg" title={isNew ? t('ward.addWard') : t('ward.editWard')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('ward.w.code')} required disabled={!isNew} value={form.code} onChange={set('code')} error={errors.code} hint={isNew ? t('ward.w.codeHint') : ''} />
        <Input label={t('ward.w.rate')} required inputMode="decimal" value={form.daily_rate} onChange={set('daily_rate')} error={errors.daily_rate} />
        <Input label={t('ward.w.name')} required value={form.name} onChange={set('name')} error={errors.name} />
        <Input label={t('ward.w.nameAm')} value={form.name_am} onChange={set('name_am')} />
        {isNew && <Input label={t('ward.w.beds')} type="number" min="0" max="50" value={form.beds} onChange={set('beds')} error={errors.beds} />}
        {!isNew && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            {t('ward.w.active')}
          </label>
        )}
        <p className="text-xs text-slate-500 sm:col-span-2">{t('ward.w.rateHint')}</p>
      </div>
    </Modal>
  );
}

// ---------------- Add beds to a ward ----------------
export function AddBedsModal({ ward, onClose, onSaved }) {
  const { t } = useTranslation();
  const [count, setCount] = useState('1');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 30) return setError('1-30');
    setBusy(true);
    try {
      await wardsApi.addBeds(ward.id, n);
      toast.success(t('ward.w.bedsAdded'));
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="sm" title={`${t('ward.addBeds')}: ${ward.code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <Input label={t('ward.w.count')} required type="number" min="1" max="30" value={count} error={error}
        onChange={(e) => { setCount(e.target.value); setError(''); }} />
    </Modal>
  );
}