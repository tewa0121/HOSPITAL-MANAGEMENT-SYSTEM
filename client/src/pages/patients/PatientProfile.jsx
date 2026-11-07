import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { patientsApi } from '../../api/patients.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { SEVERITIES, STATUS_TONE } from '../../utils/constants';
import {
  calcAge, formatDate, formatDateEt, formatDateTime, formatTime, fullName,
} from '../../utils/formatters';

const SEV_TONE = { mild: 'slate', moderate: 'amber', severe: 'red' };

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || '-'}</p>
    </div>
  );
}

export default function PatientProfile() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, canAny } = usePermission();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const [allergyOpen, setAllergyOpen] = useState(false);
  const [allergy, setAllergy] = useState({ allergen: '', reaction: '', severity: 'mild' });
  const [allergyError, setAllergyError] = useState('');
  const [toRemove, setToRemove] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return patientsApi.get(id)
      .then((res) => setPatient(res.data.data))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Error');
        navigate('/patients', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading || !patient) return <Spinner />;

  const canEditAllergies = canAny('encounters.update', 'vitals.create', 'patients.update');
  const severe = (patient.allergies || []).filter((a) => a.severity === 'severe');
  const initials = `${patient.first_name[0] || ''}${patient.father_name[0] || ''}`.toUpperCase();
  const contact = patient.contacts?.[0];

  // Tabs depend on what the backend returned for this user's permissions
  const tabs = [
    { key: 'overview', show: true },
    { key: 'allergies', show: patient.allergies !== undefined },
    { key: 'appointments', show: patient.appointments !== undefined },
    { key: 'visits', show: patient.visits !== undefined },
  ].filter((x) => x.show);

  const saveAllergy = async () => {
    if (!allergy.allergen.trim()) return setAllergyError(t('form.required'));
    setBusy(true);
    try {
      await patientsApi.addAllergy(id, allergy);
      toast.success(t('patients.allergyAdded'));
      setAllergyOpen(false);
      setAllergy({ allergen: '', reaction: '', severity: 'mild' });
      setAllergyError('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const removeAllergy = async () => {
    setBusy(true);
    try {
      await patientsApi.removeAllergy(id, toRemove.id);
      toast.success(t('patients.allergyRemoved'));
      setToRemove(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/patients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700">
        <ArrowLeft className="h-4 w-4" /> {t('form.back')}
      </Link>

      {severe.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">
            {t('patients.severeAlert')}: {severe.map((a) => a.allergen).join(', ')}
          </p>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-xl font-bold text-white">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{fullName(patient)}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{patient.mrn}</span>
                <span>{calcAge(patient.date_of_birth)}</span>
                <span>·</span>
                <span>{t(`patients.${patient.gender}`)}</span>
                {patient.blood_group !== 'unknown' && <Badge tone="red">{patient.blood_group}</Badge>}
                {patient.status !== 'active' && <Badge tone="amber">{t(`patients.statusValues.${patient.status}`)}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('appointments.create') && patient.status === 'active' && (
              <Button onClick={() => navigate(`/appointments/new?patient_id=${patient.id}`)}>
                <CalendarPlus className="h-4 w-4" /> {t('patients.bookAppointment')}
              </Button>
            )}
            {can('patients.update') && (
              <Button variant="secondary" onClick={() => navigate(`/patients/${patient.id}/edit`)}>
                <Pencil className="h-4 w-4" /> {t('form.edit')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map(({ key }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`patients.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t('patients.personal')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label={t('patients.dob')} value={`${formatDate(patient.date_of_birth)} (${formatDateEt(patient.date_of_birth, i18n.language)})`} />
              <Info label={t('patients.phone')} value={patient.phone} />
              <Info label={t('patients.maritalStatus')} value={patient.marital_status && t(`patients.marital.${patient.marital_status}`)} />
              <Info label={t('patients.occupation')} value={patient.occupation} />
              <Info label={t('patients.nationalId')} value={patient.national_id} />
              <Info label={t('patients.registered')} value={formatDate(patient.created_at)} />
            </div>
          </Card>

          <div className="space-y-6">
            <Card title={t('patients.address')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label={t('patients.region')} value={patient.region} />
                <Info label={t('patients.zone')} value={patient.zone} />
                <Info label={t('patients.woreda')} value={patient.woreda} />
                <Info label={t('patients.kebele')} value={patient.kebele} />
                <Info label={t('patients.houseNumber')} value={patient.house_number} />
              </div>
            </Card>
            <Card title={t('patients.emergencyContact')}>
              {contact ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Info label={t('patients.contactName')} value={contact.full_name} />
                  <Info label={t('patients.relationship')} value={t(`patients.rel.${contact.relationship}`, contact.relationship)} />
                  <Info label={t('patients.phone')} value={contact.phone} />
                </div>
              ) : (
                <p className="text-sm text-slate-500">-</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'allergies' && patient.allergies && (
        <Card
          title={t('patients.tabs.allergies')}
          action={canEditAllergies && (
            <Button className="!px-3 !py-1.5" onClick={() => setAllergyOpen(true)}>
              <Plus className="h-4 w-4" /> {t('patients.addAllergy')}
            </Button>
          )}
        >
          {patient.allergies.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('patients.noAllergies')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {patient.allergies.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{a.allergen}</span>
                      <Badge tone={SEV_TONE[a.severity]}>{t(`patients.sev.${a.severity}`)}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {a.reaction || '-'} · {t('patients.recordedBy')}: {a.recorded_by || '-'}
                    </p>
                  </div>
                  {canEditAllergies && (
                    <button onClick={() => setToRemove(a)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'appointments' && patient.appointments && (
        <Card className="overflow-hidden" title={t('patients.tabs.appointments')}>
          {patient.appointments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('appointments.empty')}</p>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('appointments.date')}</th>
                    <th className="px-5 py-3">{t('appointments.time')}</th>
                    <th className="px-5 py-3">{t('appointments.doctor')}</th>
                    <th className="px-5 py-3">{t('appointments.reason')}</th>
                    <th className="px-5 py-3">{t('patients.statusValues.active').length ? t('appointments.type') : ''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patient.appointments.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap px-5 py-3">{formatDate(a.appointment_date)}</td>
                      <td className="px-5 py-3">{formatTime(a.start_time)}</td>
                      <td className="px-5 py-3">{a.doctor_name}</td>
                      <td className="px-5 py-3 text-slate-500">{a.reason || '-'}</td>
                      <td className="px-5 py-3"><Badge tone={STATUS_TONE[a.status]}>{t(`appointments.status.${a.status}`)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'visits' && patient.visits && (
        <Card title={t('patients.tabs.visits')}>
          {patient.visits.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('patients.noVisits')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {patient.visits.map((v) => (
                <li key={v.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800">{formatDateTime(v.started_at)}</p>
                    <Badge tone="blue">{v.encounter_type.toUpperCase()}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">{v.doctor_name || '-'}</p>
                  {v.chief_complaint && (
                    <p className="mt-1 text-sm text-slate-600">{t('patients.chiefComplaint')}: {v.chief_complaint}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={allergyOpen}
        onClose={() => setAllergyOpen(false)}
        title={t('patients.addAllergy')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAllergyOpen(false)}>{t('form.cancel')}</Button>
            <Button onClick={saveAllergy} loading={busy}>{t('form.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('patients.allergen')} required value={allergy.allergen} error={allergyError}
            onChange={(e) => { setAllergy({ ...allergy, allergen: e.target.value }); setAllergyError(''); }}
          />
          <Input label={t('patients.reaction')} value={allergy.reaction} onChange={(e) => setAllergy({ ...allergy, reaction: e.target.value })} />
          <Select
            label={t('patients.severity')} value={allergy.severity}
            options={SEVERITIES.map((s) => ({ value: s, label: t(`patients.sev.${s}`) }))}
            onChange={(e) => setAllergy({ ...allergy, severity: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        title={t('form.confirm')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToRemove(null)}>{t('form.cancel')}</Button>
            <Button variant="danger" onClick={removeAllergy} loading={busy}>{t('form.confirm')}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t('patients.removeAllergyConfirm', { name: toRemove?.allergen })}</p>
      </Modal>
    </div>
  );
}