import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { encountersApi } from '../../api/encounters.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { COMMON_DIAGNOSES } from '../../utils/constants';
import { errMsg } from '../../utils/errors';

export default function DiagnosisPanel({ enc, editable, onChanged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ icd10_code: '', description: '', type: 'primary' });
  const [error, setError] = useState('');
  const [toRemove, setToRemove] = useState(null);
  const [busy, setBusy] = useState(false);

  const hasPrimary = enc.diagnoses.some((d) => d.type === 'primary');

  const openAdd = () => {
    setForm({ icd10_code: '', description: '', type: hasPrimary ? 'secondary' : 'primary' });
    setError('');
    setOpen(true);
  };

  // choosing a suggestion from the list fills the ICD-10 code too
  const onDescription = (e) => {
    const description = e.target.value;
    const match = COMMON_DIAGNOSES.find((d) => d.name === description);
    setForm((f) => ({ ...f, description, icd10_code: match ? match.code : f.icd10_code }));
    setError('');
  };

  const save = async () => {
    if (!form.description.trim()) return setError(t('form.required'));
    setBusy(true);
    try {
      await encountersApi.addDiagnosis(enc.id, form);
      toast.success(t('consult.dx.added'));
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await encountersApi.removeDiagnosis(enc.id, toRemove.id);
      toast.success(t('consult.dx.removed'));
      setToRemove(null);
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const typeOptions = hasPrimary
    ? [{ value: 'secondary', label: t('consult.dx.secondary') }]
    : [{ value: 'primary', label: t('consult.dx.primary') }, { value: 'secondary', label: t('consult.dx.secondary') }];

  return (
    <Card
      title={t('consult.dx.title')}
      action={editable && (
        <Button className="!px-3 !py-1.5" onClick={openAdd}>
          <Plus className="h-4 w-4" /> {t('consult.dx.add')}
        </Button>
      )}
    >
      {enc.diagnoses.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">{t('consult.dx.none')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {enc.diagnoses.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{d.description}</span>
                {d.icd10_code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{d.icd10_code}</span>}
                <Badge tone={d.type === 'primary' ? 'teal' : 'slate'}>{t(`consult.dx.${d.type}`)}</Badge>
              </div>
              {editable && (
                <button onClick={() => setToRemove(d)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} title={t('consult.dx.add')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('form.cancel')}</Button>
            <Button onClick={save} loading={busy}>{t('form.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <Input label={t('consult.dx.description')} required list="dx-list" value={form.description} onChange={onDescription} autoFocus />
          <datalist id="dx-list">
            {COMMON_DIAGNOSES.map((d) => <option key={d.code} value={d.name} />)}
          </datalist>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('consult.dx.code')} value={form.icd10_code} placeholder="B54" onChange={(e) => setForm({ ...form, icd10_code: e.target.value })} />
            <Select label={t('consult.dx.type')} options={typeOptions} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!toRemove} onClose={() => setToRemove(null)} title={t('form.confirm')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToRemove(null)}>{t('form.cancel')}</Button>
            <Button variant="danger" onClick={remove} loading={busy}>{t('form.confirm')}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t('consult.dx.removeConfirm', { name: toRemove?.description })}</p>
      </Modal>
    </Card>
  );
}