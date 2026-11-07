import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { loadPublicSettings } from '../../i18n';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { errMsg } from '../../utils/errors';

const SLOTS = ['10', '15', '20', '30', '45', '60'];

export default function Settings() {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [orig, setOrig] = useState(null);
  const [currency, setCurrency] = useState('ETB');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.settings()
      .then((res) => {
        const s = res.data.data;
        const f = {
          hospital_name: s.hospital_name || '', hospital_name_am: s.hospital_name_am || '',
          default_language: s.default_language || 'en', mrn_prefix: s.mrn_prefix || 'HMS',
          appointment_slot_minutes: s.appointment_slot_minutes || '20',
        };
        setForm(f);
        setOrig(f);
        setCurrency(s.currency || 'ETB');
      })
      .catch((err) => toast.error(errMsg(err, t('login.networkError'))));
  }, [t]);

  if (!form) return <Spinner />;

  const dirty = JSON.stringify(form) !== JSON.stringify(orig);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async () => {
    const er = {};
    if (form.hospital_name.trim().length < 2 || form.hospital_name.trim().length > 100) er.hospital_name = t('admin.settings.nameShort');
    if (!/^[A-Za-z0-9]{2,6}$/.test(form.mrn_prefix.trim())) er.mrn_prefix = t('admin.settings.prefixInvalid');
    setErrors(er);
    if (Object.keys(er).length) return;

    setSaving(true);
    try {
      const res = await adminApi.saveSettings({ ...form, mrn_prefix: form.mrn_prefix.trim().toUpperCase() });
      const changed = Object.keys(res.data.data || {}).length;
      toast.success(changed ? t('admin.settings.saved') : t('admin.settings.nothing'));
      const next = { ...form, mrn_prefix: form.mrn_prefix.trim().toUpperCase() };
      setForm(next);
      setOrig(next);
      await loadPublicSettings(); // the new hospital name shows everywhere straight away
    } catch (err) {
      const list = err.response?.data?.errors;
      if (Array.isArray(list)) setErrors(Object.fromEntries(list.map((x) => [x.field, x.message])));
      else toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.settings')}</h1>
        <p className="text-slate-500">{t('admin.settings.subtitle')}</p>
      </div>

      <Card title={t('admin.settings.hospital')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('admin.settings.name')} required value={form.hospital_name} onChange={set('hospital_name')} error={errors.hospital_name} />
          <Input label={t('admin.settings.nameAm')} value={form.hospital_name_am} onChange={set('hospital_name_am')} error={errors.hospital_name_am} />
          <p className="text-xs text-slate-500 sm:col-span-2">{t('admin.settings.nameHint')}</p>
        </div>
      </Card>

      <Card title={t('admin.settings.system')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('admin.settings.currency')} value={currency} disabled readOnly hint={t('admin.settings.currencyHint')} />
          <Select
            label={t('admin.settings.language')} value={form.default_language} onChange={set('default_language')}
            options={[{ value: 'en', label: t('admin.settings.en') }, { value: 'am', label: t('admin.settings.am') }]}
            error={errors.default_language}
          />
          <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">{t('admin.settings.languageHint')}</p>

          <div>
            <Input label={t('admin.settings.mrnPrefix')} required value={form.mrn_prefix} onChange={set('mrn_prefix')} error={errors.mrn_prefix} hint={t('admin.settings.mrnHint')} />
            <p className="mt-1 text-xs text-slate-500">
              {t('admin.settings.preview')}: <span className="font-mono font-semibold">{(form.mrn_prefix.trim() || '...').toUpperCase()}-{new Date().getFullYear()}-000001</span>
            </p>
          </div>
          <Select
            label={`${t('admin.settings.slot')} (${t('admin.settings.minutes')})`} value={form.appointment_slot_minutes} onChange={set('appointment_slot_minutes')}
            options={SLOTS.map((m) => ({ value: m, label: `${m} ${t('admin.settings.minutes')}` }))} error={errors.appointment_slot_minutes}
          />
          <p className="text-xs text-slate-500 sm:col-span-2">{t('admin.settings.slotHint')}</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={!dirty}>{t('form.save')}</Button>
      </div>
    </div>
  );
}