import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, BedDouble, CheckCircle2, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { encountersApi } from '../../api/encounters.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import VitalsPanel from './VitalsPanel';
import NotesPanel from './NotesPanel';
import DiagnosisPanel from './DiagnosisPanel';
import LabPanel from './LabPanel';
import PrescriptionPanel from './PrescriptionPanel';
import { ENCOUNTER_TONE } from '../../utils/constants';
import { calcAge, formatDate, formatDateTime, fullName } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';


const PENDING_LAB = ['ordered', 'collected', 'processing', 'resulted'];
const SEV_TONE = { mild: 'slate', moderate: 'amber', severe: 'red' };

const pickNotes = (e) => ({
  chief_complaint: e.chief_complaint || '',
  history_present_illness: e.history_present_illness || '',
  examination: e.examination || '',
  treatment_plan: e.treatment_plan || '',
  follow_up_date: e.follow_up_date ? String(e.follow_up_date).slice(0, 10) : '',
});

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value || '-'}</span>
    </div>
  );
}

export default function Consultation() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();

  const [enc, setEnc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotesState] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await encountersApi.get(id);
      setEnc(res.data.data);
    } catch (err) {
      toast.error(errMsg(err, 'Error'));
      navigate('/opd', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { setLoading(true); setDirty(false); load(); }, [load]);

  // keep the notes form in sync with the server unless the doctor is typing
  useEffect(() => { if (enc && !dirty) setNotesState(pickNotes(enc)); }, [enc, dirty]);

  const setNotes = (patch) => { setNotesState((n) => ({ ...n, ...patch })); setDirty(true); };

  const saveNotes = async (silent = false) => {
    setSaving(true);
    try {
      await encountersApi.saveNotes(id, notes);
      if (!silent) toast.success(t('consult.notes.saved'));
      await load();
      setDirty(false);
    } catch (err) {
      toast.error(errMsg(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      await encountersApi.start(id);
      toast.success(t('consult.started'));
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !enc) return <Spinner />;

  const open = !['completed', 'cancelled'].includes(enc.status);
  const active = ['in_consultation', 'awaiting_results'].includes(enc.status);
  const pending = (enc.lab_orders || []).filter((o) => PENDING_LAB.includes(o.status)).length;
  const hasDx = (enc.diagnoses || []).length > 0;
  const p = enc.patient;
  const severe = enc.allergies.filter((a) => a.severity === 'severe');

  const closeVisit = async () => {
    setBusy(true);
    try {
      if (dirty) await saveNotes(true);
      await encountersApi.close(id, pending > 0);
      toast.success(t('consult.completedOk'));
      setCloseOpen(false);
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/opd" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700">
        <ArrowLeft className="h-4 w-4" /> {t('form.back')}
      </Link>

      {severe.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{t('consult.severeAlert')}: {severe.map((a) => a.allergen).join(', ')}</p>
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
                <Badge tone={ENCOUNTER_TONE[enc.status]}>{t(`opd.status.${enc.status}`)}</Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {['waiting', 'triaged'].includes(enc.status) && can('encounters.update') && (
              <Button onClick={start} loading={busy}><Play className="h-4 w-4" /> {t('consult.start')}</Button>
            )}
            {active && can('encounters.close') && (
              <Button onClick={() => setCloseOpen(true)}><CheckCircle2 className="h-4 w-4" /> {t('consult.complete')}</Button>
            )}
            {open && can('admissions.create') && (
              <Button
                variant="secondary"
                onClick={() => navigate('/admissions', { state: { admit: { encounter_id: enc.id, patient: p } } })}
              >
                <BedDouble className="h-4 w-4" /> {t('adm.admitPatient')}
              </Button>
            )}
          </div>
        </div>

        {['waiting', 'triaged'].includes(enc.status) && can('encounters.update') && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{t('consult.waitingHint')}</p>
        )}
        {!open && <p className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">{t('consult.closedHint')}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {enc.vitals && <VitalsPanel enc={enc} canRecord={open && can('vitals.create')} onChanged={load} />}
          <NotesPanel
            notes={notes} setNotes={setNotes} dirty={dirty} saving={saving}
            editable={active && can('encounters.update')} onSave={() => saveNotes().catch(() => {})}
          />
          {enc.diagnoses && <DiagnosisPanel enc={enc} editable={active && can('diagnoses.create')} onChanged={load} />}
          {enc.lab_orders && <LabPanel enc={enc} canOrder={active && can('lab.order')} onChanged={load} />}
          {enc.prescriptions && <PrescriptionPanel enc={enc} canPrescribe={active && can('prescriptions.create')} onChanged={load} />}
        </div>

        <div className="space-y-6">
          <Card title={t('consult.patientCard')}>
            <div className="divide-y divide-slate-100">
              <Row label={t('patients.phone')} value={p.phone} />
              <Row label={t('patients.dob')} value={formatDate(p.date_of_birth)} />
              <Row label={t('consult.doctor')} value={enc.doctor_name} />
              <Row label={t('consult.queueNo')} value={enc.queue_number} />
              <Row label={t('consult.arrived')} value={formatDateTime(enc.started_at)} />
              <Row label={t('consult.reason')} value={enc.appointment_reason} />
            </div>
            {can('patients.read') && (
              <Link to={`/patients/${p.id}`} className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">
                {t('consult.openProfile')}
              </Link>
            )}
          </Card>

          <Card title={t('consult.allergies')}>
            {enc.allergies.length === 0 ? (
              <p className="text-sm text-slate-500">{t('consult.noAllergies')}</p>
            ) : (
              <ul className="space-y-2">
                {enc.allergies.map((a) => (
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

      <Modal
        open={closeOpen} onClose={() => setCloseOpen(false)} title={t('consult.completeTitle')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseOpen(false)}>{t('form.cancel')}</Button>
            <Button onClick={closeVisit} loading={busy} disabled={!hasDx}>{t('form.confirm')}</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>{t('consult.completeMsg')}</p>
          {!hasDx && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{t('consult.noDx')}</p>}
          {pending > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{t('consult.pendingLabs', { n: pending })}</p>}
        </div>
      </Modal>
    </div>
  );
}