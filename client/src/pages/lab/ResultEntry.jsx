import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { labApi } from '../../api/lab.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { FLAG_TONE } from '../../utils/constants';
import { isNumericTest, previewFlag, QUALITATIVE_VALUES } from '../../utils/lab';
import { errMsg } from '../../utils/errors';

export default function ResultEntry({ order, onClose, onSaved }) {
  const { t } = useTranslation();
  const numeric = isNumericTest(order);

  const [value, setValue] = useState(order.result_value || '');
  const [flag, setFlag] = useState(['normal', 'high', 'critical'].includes(order.result_flag) ? order.result_flag : 'normal');
  const [comment, setComment] = useState(order.result_comment || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const shown = numeric ? previewFlag(order, value) : flag;

  const save = async () => {
    if (!value.trim()) return setError(t('lab.resultModal.required'));
    if (numeric && !previewFlag(order, value)) return setError(t('lab.resultModal.notNumber'));
    setBusy(true);
    try {
      await labApi.saveResult(order.id, {
        result_value: value,
        result_flag: numeric ? undefined : flag,
        result_comment: comment,
      });
      toast.success(t('lab.msg.resultSaved'));
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const flagOptions = ['normal', 'high', 'critical'].map((f) => ({ value: f, label: t(`lab.qualFlag.${f}`) }));

  return (
    <Modal
      open onClose={onClose} title={t('lab.resultModal.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-800">{order.test_name}</p>
          <p className="text-slate-500">{order.patient_name} · <span className="font-mono text-xs">{order.mrn}</span></p>
          <p className="mt-1 text-slate-600">
            {t('lab.resultModal.reference')}: <strong>{order.ref_text || '-'}</strong> {order.unit || ''}
          </p>
        </div>

        {order.status === 'resulted' && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('lab.resultModal.correction')}</p>
        )}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <Input
          label={`${t('lab.resultModal.value')}${order.unit ? ` (${order.unit})` : ''}`} required autoFocus
          value={value} list={numeric ? undefined : 'qual-values'}
          inputMode={numeric ? 'decimal' : 'text'}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
        />
        {!numeric && <datalist id="qual-values">{QUALITATIVE_VALUES.map((v) => <option key={v} value={v} />)}</datalist>}

        {numeric ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {t('lab.resultModal.flag')}:
            {shown ? <Badge tone={FLAG_TONE[shown]}>{t(`lab.flag.${shown}`)}</Badge> : <span className="text-slate-400">-</span>}
            <span className="text-xs text-slate-400">({t('lab.resultModal.autoFlag')})</span>
          </div>
        ) : (
          <Select label={t('lab.resultModal.flag')} options={flagOptions} value={flag} onChange={(e) => setFlag(e.target.value)} />
        )}

        <Input label={t('lab.resultModal.comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
    </Modal>
  );
}