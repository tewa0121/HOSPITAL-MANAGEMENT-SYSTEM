import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { encountersApi } from '../../api/encounters.api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { calcBmi, vitalFlag } from '../../utils/vitals';
import { formatDateTime } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const EMPTY = {
  temperature_c: '', pulse: '', respiratory_rate: '', bp_systolic: '', bp_diastolic: '',
  spo2: '', weight_kg: '', height_cm: '',
};

const FLAG_STYLE = {
  high: 'border-red-200 bg-red-50 text-red-700',
  low: 'border-amber-200 bg-amber-50 text-amber-700',
};

function Tile({ label, value, unit, flag }) {
  const style = flag ? FLAG_STYLE[flag] : 'border-slate-200 bg-slate-50 text-slate-800';
  return (
    <div className={`rounded-xl border p-3 ${style}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {value === null || value === undefined || value === '' ? '-' : value}
        {value !== null && value !== undefined && value !== '' && <span className="ml-1 text-xs font-medium opacity-70">{unit}</span>}
      </p>
    </div>
  );
}

export default function VitalsPanel({ enc, canRecord, onChanged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const latest = enc.vitals[0];
  const history = enc.vitals.slice(1);
  const bmi = latest ? calcBmi(latest.weight_kg, latest.height_cm) : null;
  const bpFlag = latest ? vitalFlag('bp_systolic', latest.bp_systolic) || vitalFlag('bp_diastolic', latest.bp_diastolic) : null;
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(''); };

  const save = async () => {
    const vals = Object.values(form).filter((v) => v !== '');
    if (!vals.length) return setError(t('consult.vitals.atLeast'));
    if ((form.bp_systolic === '') !== (form.bp_diastolic === '')) return setError(t('consult.vitals.bpBoth'));
    if (form.bp_systolic && Number(form.bp_systolic) <= Number(form.bp_diastolic)) return setError(t('consult.vitals.bpOrder'));
    setBusy(true);
    try {
      await encountersApi.addVitals(enc.id, form);
      toast.success(t('consult.vitals.saved'));
      setOpen(false);
      setForm(EMPTY);
      await onChanged();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, unit, step) => (
    <Input label={`${label} (${unit})`} type="number" step={step} min="0" value={form[key]} onChange={set(key)} />
  );

  return (
    <Card
      title={t('consult.vitals.title')}
      action={canRecord && (
        <Button className="!px-3 !py-1.5" onClick={() => { setForm(EMPTY); setError(''); setOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('consult.vitals.record')}
        </Button>
      )}
    >
      {!latest ? (
        <p className="py-4 text-center text-sm text-slate-500">{t('consult.vitals.none')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t('consult.vitals.temperature')} value={latest.temperature_c} unit="°C" flag={vitalFlag('temperature_c', latest.temperature_c)} />
            <Tile label={t('consult.vitals.pulse')} value={latest.pulse} unit="/min" flag={vitalFlag('pulse', latest.pulse)} />
            <Tile label={t('consult.vitals.bp')} value={latest.bp_systolic ? `${latest.bp_systolic}/${latest.bp_diastolic}` : null} unit="mmHg" flag={bpFlag} />
            <Tile label={t('consult.vitals.spo2')} value={latest.spo2} unit="%" flag={vitalFlag('spo2', latest.spo2)} />
            <Tile label={t('consult.vitals.rr')} value={latest.respiratory_rate} unit="/min" flag={vitalFlag('respiratory_rate', latest.respiratory_rate)} />
            <Tile label={t('consult.vitals.weight')} value={latest.weight_kg} unit="kg" />
            <Tile label={t('consult.vitals.height')} value={latest.height_cm} unit="cm" />
            <Tile label={t('consult.vitals.bmi')} value={bmi} unit="" />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {t('consult.vitals.by')}: {latest.recorded_by_name || '-'} · {formatDateTime(latest.recorded_at)}
          </p>
          <p className="text-xs text-slate-400">{t('consult.vitals.hint')}</p>

          {history.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('consult.vitals.history')}</p>
              <ul className="space-y-1 text-sm text-slate-600">
                {history.map((v) => (
                  <li key={v.id}>
                    <span className="text-slate-400">{String(v.recorded_at).slice(11, 16)}</span>{' '}
                    {v.temperature_c ? `${v.temperature_c}°C` : ''} {v.pulse ? `· ${v.pulse}/min` : ''}{' '}
                    {v.bp_systolic ? `· ${v.bp_systolic}/${v.bp_diastolic}` : ''} {v.spo2 ? `· SpO2 ${v.spo2}%` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} title={t('consult.vitals.record')} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('form.cancel')}</Button>
            <Button onClick={save} loading={busy}>{t('form.save')}</Button>
          </>
        }
      >
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('temperature_c', t('consult.vitals.temperature'), '°C', '0.1')}
          {field('pulse', t('consult.vitals.pulse'), '/min', '1')}
          {field('bp_systolic', t('consult.vitals.systolic'), 'mmHg', '1')}
          {field('bp_diastolic', t('consult.vitals.diastolic'), 'mmHg', '1')}
          {field('respiratory_rate', t('consult.vitals.rr'), '/min', '1')}
          {field('spo2', t('consult.vitals.spo2'), '%', '1')}
          {field('weight_kg', t('consult.vitals.weight'), 'kg', '0.1')}
          {field('height_cm', t('consult.vitals.height'), 'cm', '0.1')}
        </div>
      </Modal>
    </Card>
  );
}