import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { wardsApi } from '../../api/wards.api';
import { patientsApi } from '../../api/patients.api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Textarea from '../../components/ui/Textarea';
import { wardName } from '../../utils/wards';
import { formatBirr, fullName } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

// Free beds grouped by ward. Beds that do not suit the patient are disabled with the reason.
export function BedPicker({ patientId, value, onChange }) {
  const { t, i18n } = useTranslation();
  const [beds, setBeds] = useState(null);

  useEffect(() => {
    if (!patientId) { setBeds(null); return undefined; }
    let off = false;
    setBeds(null);
    wardsApi.availableBeds(patientId)
      .then((r) => { if (!off) setBeds(r.data.data); })
      .catch((err) => { if (!off) { setBeds([]); toast.error(errMsg(err)); } });
    return () => { off = true; };
  }, [patientId]);

  if (!patientId) return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">{t('adm.admit.pickPatientFirst')}</p>;
  if (!beds) return <Spinner />;
  if (beds.length === 0) return <p className="text-sm text-slate-500">{t('adm.admit.noBeds')}</p>;

  const groups = [];
  beds.forEach((b) => {
    let g = groups.find((x) => x.ward_id === b.ward_id);
    if (!g) { g = { ward_id: b.ward_id, ward_name: b.ward_name, ward_name_am: b.ward_name_am, rate: b.daily_rate, reason: b.reason, beds: [] }; groups.push(g); }
    g.beds.push(b);
  });

  return (
    <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
      {groups.map((g) => (
        <div key={g.ward_id}>
          <p className="text-sm font-semibold text-slate-700">
            {wardName(g, i18n.language)} <span className="font-normal text-slate-400">· {formatBirr(g.rate)} / {t('adm.sum.days')}</span>
          </p>
          {g.reason && <p className="mb-1 text-xs text-amber-700">{g.reason}</p>}
          <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {g.beds.map((b) => (
              <button
                key={b.id} type="button" disabled={!b.eligible} title={b.reason || ''}
                onClick={() => onChange(b.id)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                  value === b.id ? 'border-teal-600 bg-teal-600 text-white shadow'
                    : b.eligible ? 'border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:bg-teal-50'
                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                }`}
              >
                {b.bed_number}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Admit a patient ----------------
export function AdmitModal({ preset, onClose, onAdmitted }) {
  const { t } = useTranslation();
  const [patient, setPatient] = useState(preset?.patient || null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [bedId, setBedId] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (patient || search.trim().length < 2) { setResults([]); setSearched(false); return undefined; }
    let off = false;
    const id = setTimeout(() => {
      patientsApi.list({ search: search.trim(), status: 'active', limit: 6 })
        .then((r) => { if (!off) { setResults(r.data.data.items); setSearched(true); } })
        .catch(() => {});
    }, 300);
    return () => { off = true; clearTimeout(id); };
  }, [search, patient]);

  const save = async () => {
    const er = {};
    if (!patient) er.patient = t('adm.admit.patientRequired');
    if (!bedId) er.bed = t('adm.admit.bedRequired');
    if (reason.trim().length < 3) er.reason = t('adm.admit.required');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const res = await wardsApi.admit({
        patient_id: patient.id, bed_id: bedId, reason, encounter_id: preset?.encounter_id,
      });
      toast.success(`${t('adm.admit.saved')}: ${res.data.data.bed}`);
      onAdmitted(res.data.data.id);
    } catch (err) {
      toast.error(errMsg(err));
      if (err.response?.status === 409) setBedId(null);
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="lg" title={t('adm.admit.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('adm.admitPatient')}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('adm.admit.patient')}<span className="text-red-500"> *</span></label>
          {patient ? (
            <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div>
                <p className="font-semibold text-slate-800">{fullName(patient)}</p>
                <p className="text-xs text-slate-500">{patient.mrn}{preset?.encounter_id ? ` · ${t('adm.admit.fromVisit')}` : ''}</p>
              </div>
              {!preset?.patient && (
                <button type="button" onClick={() => { setPatient(null); setBedId(null); setSearch(''); }} className="text-sm font-medium text-teal-700 hover:underline">
                  {t('adm.admit.change')}
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input
                value={search} onChange={(e) => { setSearch(e.target.value); setErrors((x) => ({ ...x, patient: undefined })); }}
                placeholder={t('adm.admit.searchPatientPh')}
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {searched && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {results.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500">{t('adm.admit.noPatient')}</li>
                  ) : results.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => { setPatient(p); setResults([]); }} className="w-full px-4 py-2.5 text-left hover:bg-teal-50">
                        <p className="text-sm font-medium text-slate-800">{fullName(p)}</p>
                        <p className="text-xs text-slate-500">{p.mrn} · {p.phone || '-'}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {errors.patient && <p className="mt-1 text-xs text-red-600">{errors.patient}</p>}
        </div>

        <Textarea
          label={t('adm.admit.reason')} required rows={2} value={reason} placeholder={t('adm.admit.reasonPh')} error={errors.reason}
          onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })); }}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('adm.admit.bed')}<span className="text-red-500"> *</span></label>
          <BedPicker patientId={patient?.id} value={bedId} onChange={(id) => { setBedId(id); setErrors((x) => ({ ...x, bed: undefined })); }} />
          {errors.bed && <p className="mt-1 text-xs text-red-600">{errors.bed}</p>}
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Transfer to another bed ----------------
export function TransferModal({ admission, onClose, onDone }) {
  const { t } = useTranslation();
  const [bedId, setBedId] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const er = {};
    if (!bedId) er.bed = t('adm.admit.bedRequired');
    if (reason.trim().length < 3) er.reason = t('adm.admit.required');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      await wardsApi.transfer(admission.id, { bed_id: bedId, reason });
      toast.success(t('adm.transfer.saved'));
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
      if (err.response?.status === 409) setBedId(null);
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="lg" title={t('adm.transfer.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('adm.transfer.action')}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <strong className="text-slate-800">{admission.patient_name}</strong> · {t('adm.transfer.current')}: <strong>{admission.bed_number}</strong>
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('adm.admit.bed')}<span className="text-red-500"> *</span></label>
          <BedPicker patientId={admission.patient_id} value={bedId} onChange={(id) => { setBedId(id); setErrors((x) => ({ ...x, bed: undefined })); }} />
          {errors.bed && <p className="mt-1 text-xs text-red-600">{errors.bed}</p>}
        </div>
        <Textarea
          label={t('adm.transfer.reason')} required rows={2} value={reason} placeholder={t('adm.transfer.reasonPh')} error={errors.reason}
          onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })); }}
        />
        <p className="text-xs text-slate-500">{t('adm.transfer.hint')}</p>
      </div>
    </Modal>
  );
}