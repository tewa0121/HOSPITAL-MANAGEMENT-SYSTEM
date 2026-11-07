import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { patientsApi } from '../../api/patients.api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { BLOOD_GROUPS, MARITAL, PHONE_RE, REGIONS, RELATIONSHIPS } from '../../utils/constants';
import { formatDate, formatDateEt, fullName, todayISO } from '../../utils/formatters';

const EMPTY = {
  first_name: '', father_name: '', grandfather_name: '', gender: '', date_of_birth: '',
  phone: '', national_id: '', blood_group: 'unknown', marital_status: '', occupation: '',
  region: 'Amhara', zone: '', woreda: '', kebele: '', house_number: '',
  ec_name: '', ec_relationship: 'Spouse', ec_phone: '',
};

const cleanPhone = (v) => v.replace(/[\s-]/g, '');

export default function PatientForm() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    patientsApi.get(id)
      .then((res) => {
        const p = res.data.data;
        const c = p.contacts?.[0];
        const base = {};
        Object.keys(EMPTY).forEach((k) => { base[k] = p[k] ?? EMPTY[k]; });
        setForm({
          ...base,
          ec_name: c?.full_name || '',
          ec_relationship: c?.relationship || 'Spouse',
          ec_phone: c?.phone || '',
        });
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Error'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    const req = t('form.required');
    if (!form.first_name.trim()) e.first_name = req;
    if (!form.father_name.trim()) e.father_name = req;
    if (!form.gender) e.gender = req;
    if (!form.date_of_birth) e.date_of_birth = req;
    else if (form.date_of_birth > todayISO()) e.date_of_birth = t('patients.dobFuture');
    if (form.phone && !PHONE_RE.test(cleanPhone(form.phone))) e.phone = t('patients.phoneInvalid');
    if (form.ec_phone && !PHONE_RE.test(cleanPhone(form.ec_phone))) e.ec_phone = t('patients.phoneInvalid');
    const hasName = !!form.ec_name.trim();
    const hasPhone = !!form.ec_phone.trim();
    if (hasName && !hasPhone && !e.ec_phone) e.ec_phone = t('patients.ecIncomplete');
    if (!hasName && hasPhone) e.ec_name = t('patients.ecIncomplete');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (force = false) => {
    if (!force && !validate()) return;
    const payload = {
      ...form,
      emergency_contact: { full_name: form.ec_name, relationship: form.ec_relationship, phone: form.ec_phone },
    };
    setSaving(true);
    setDuplicates(null);
    try {
      if (isEdit) {
        await patientsApi.update(id, payload);
        toast.success(t('patients.updated'));
        navigate(`/patients/${id}`);
      } else {
        const res = await patientsApi.create(payload, force);
        toast.success(t('patients.saved'));
        navigate(`/patients/${res.data.data.id}`);
      }
    } catch (err) {
      const r = err.response;
      if (r?.status === 409 && r.data?.errors?.duplicates) {
        setDuplicates(r.data.errors.duplicates);
      } else if (r?.status === 422) {
        const mapped = {};
        r.data.errors.forEach((x) => {
          const key = x.field === 'emergency_contact.phone' ? 'ec_phone'
            : x.field.startsWith('emergency_contact') ? 'ec_name' : x.field;
          mapped[key] = x.message;
        });
        setErrors(mapped);
      } else {
        toast.error(r?.data?.message || t('login.networkError'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  const genderOpts = [{ value: 'male', label: t('patients.male') }, { value: 'female', label: t('patients.female') }];
  const bloodOpts = [{ value: 'unknown', label: t('patients.unknown') }, ...BLOOD_GROUPS.map((b) => ({ value: b, label: b }))];
  const maritalOpts = MARITAL.map((m) => ({ value: m, label: t(`patients.marital.${m}`) }));
  const regionOpts = REGIONS.map((r) => ({ value: r, label: r }));
  const relOpts = RELATIONSHIPS.map((r) => ({ value: r, label: t(`patients.rel.${r}`) }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to={isEdit ? `/patients/${id}` : '/patients'} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700">
          <ArrowLeft className="h-4 w-4" /> {t('form.back')}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {isEdit ? t('patients.editTitle') : t('patients.registerTitle')}
        </h1>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-6" noValidate>
        <Card title={t('patients.personal')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label={t('patients.firstName')} required value={form.first_name} onChange={set('first_name')} error={errors.first_name} />
            <Input label={t('patients.fatherName')} required value={form.father_name} onChange={set('father_name')} error={errors.father_name} />
            <Input label={t('patients.grandfatherName')} value={form.grandfather_name} onChange={set('grandfather_name')} error={errors.grandfather_name} />

            <Select label={t('patients.gender')} required placeholder={t('form.select')} options={genderOpts} value={form.gender} onChange={set('gender')} error={errors.gender} />
            <Input
              label={t('patients.dob')} required type="date" max={todayISO()}
              value={form.date_of_birth} onChange={set('date_of_birth')} error={errors.date_of_birth}
              hint={form.date_of_birth ? `${t('patients.ethiopianDate')}: ${formatDateEt(form.date_of_birth, i18n.language)}` : ''}
            />
            <Input label={t('patients.phone')} value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="09XXXXXXXX" hint={t('patients.phoneHint')} />

            <Select label={t('patients.bloodGroup')} options={bloodOpts} value={form.blood_group} onChange={set('blood_group')} error={errors.blood_group} />
            <Select label={t('patients.maritalStatus')} placeholder={t('form.select')} options={maritalOpts} value={form.marital_status} onChange={set('marital_status')} />
            <Input label={t('patients.occupation')} value={form.occupation} onChange={set('occupation')} />

            <Input className="sm:col-span-3" label={t('patients.nationalId')} value={form.national_id} onChange={set('national_id')} />
          </div>
        </Card>

        <Card title={t('patients.address')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label={t('patients.region')} placeholder={t('form.select')} options={regionOpts} value={form.region} onChange={set('region')} />
            <Input label={t('patients.zone')} value={form.zone} onChange={set('zone')} />
            <Input label={t('patients.woreda')} value={form.woreda} onChange={set('woreda')} />
            <Input label={t('patients.kebele')} value={form.kebele} onChange={set('kebele')} />
            <Input label={t('patients.houseNumber')} value={form.house_number} onChange={set('house_number')} />
          </div>
        </Card>

        <Card title={t('patients.emergencyContact')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label={t('patients.contactName')} value={form.ec_name} onChange={set('ec_name')} error={errors.ec_name} />
            <Select label={t('patients.relationship')} options={relOpts} value={form.ec_relationship} onChange={set('ec_relationship')} />
            <Input label={t('patients.phone')} value={form.ec_phone} onChange={set('ec_phone')} error={errors.ec_phone} placeholder="09XXXXXXXX" />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>{t('form.cancel')}</Button>
          <Button type="submit" loading={saving}>{saving ? t('form.saving') : t('form.save')}</Button>
        </div>
      </form>

      <Modal
        open={!!duplicates}
        onClose={() => setDuplicates(null)}
        title={t('patients.duplicateTitle')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicates(null)}>{t('form.cancel')}</Button>
            <Button onClick={() => submit(true)} loading={saving}>{t('patients.registerAnyway')}</Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-600">{t('patients.duplicateMsg')}</p>
        <ul className="space-y-2">
          {duplicates?.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div>
                <p className="font-semibold text-slate-800">{fullName(d)}</p>
                <p className="text-xs text-slate-600">{d.mrn} · {formatDate(d.date_of_birth)} · {d.phone || '-'}</p>
              </div>
              <Link to={`/patients/${d.id}`} className="text-sm font-medium text-teal-700 hover:underline">
                {t('patients.openRecord')}
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}