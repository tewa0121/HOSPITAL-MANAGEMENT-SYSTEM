import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, ArrowRightLeft, DoorOpen, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { wardsApi } from '../../api/wards.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Textarea from '../../components/ui/Textarea';
import { TransferModal } from './AdmitModal';
import { ADM_TONE, wardName } from '../../utils/wards';
import { INV_TONE } from '../../utils/billing';
import { calcAge, formatBirr, formatDateTime, formatDate } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const SEV_TONE = { mild: 'slate', moderate: 'amber', severe: 'red' };

export default function AdmissionDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, canAny } = usePermission();

  const [adm, setAdm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'transfer' | 'discharge'
  const [summary, setSummary] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await wardsApi.admission(id);
      setAdm(res.data.data);
    } catch (err) {
      toast.error(errMsg(err, 'Error'));
      navigate('/admissions', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading || !adm) return <Spinner />;

  const admitted = adm.status === 'admitted';
  const clinical = adm.notes !== undefined;
  const severe = (adm.allergies || []).filter((a) => a.severity === 'severe');

  const saveNote = async () => {
    if (note.trim().length < 3) return setNoteError(t('adm.admit.required'));
    setBusy(true);
    try {
      await wardsApi.addNote(id, note);
      toast.success(t('adm.d.noteAdded'));
      setNote('');
      await load();
    } catch (err) {
      setNoteError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const doDischarge = async () => {
    if (summary.trim().length < 10) return setSummaryError(t('adm.discharge.required'));
    setBusy(true);
    try {
      await wardsApi.discharge(id, summary);
      toast.success(t('adm.discharge.saved'));
      setModal(null);
      await load();
    } catch (err) {
      setSummaryError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/admissions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 print:hidden">
        <ArrowLeft className="h-4 w-4" /> {t('adm.d.back')}
      </Link>

      <div className="hidden text-center print:block">
        <p className="text-xl font-bold">{t('app.hospital')}</p>
        <p className="text-sm text-slate-500">{t('adm.discharge.summary')}</p>
      </div>

      {severe.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{t('consult.severeAlert')}: {severe.map((a) => a.allergen).join(', ')}</p>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{adm.patient_name}</h1>
              <Badge tone={ADM_TONE[adm.status]}>{t(`adm.status.${adm.status}`)}</Badge>
              {adm.blood_group !== 'unknown' && <Badge tone="red">{adm.blood_group}</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{adm.mrn}</span>{' '}
              {calcAge(adm.date_of_birth)} · {t(`patients.${adm.gender}`)} · {adm.patient_phone || '-'}
            </p>
            <div className="mt-3 grid gap-x-8 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
              <p>{t('adm.d.bed')}: <strong className="text-slate-800">{adm.bed_number}</strong> ({wardName(adm, i18n.language)})</p>
              <p>{t('adm.d.stay')}: <strong className="text-slate-800">{adm.days} {t('adm.d.days')}</strong>{admitted && <span className="text-slate-400"> · {t('adm.d.stillAdmitted')}</span>}</p>
              <p>{t('adm.d.admitted')}: {formatDateTime(adm.admitted_at)}</p>
              <p>{t('adm.d.by')}: {adm.doctor_name}</p>
              {adm.discharged_at && <p>{t('adm.d.discharged')}: {formatDateTime(adm.discharged_at)}</p>}
              {adm.discharged_by_name && <p>{t('adm.d.dischargedBy')}: {adm.discharged_by_name}</p>}
            </div>
            {adm.encounter_id && can('encounters.read') && (
              <Link to={`/opd/${adm.encounter_id}`} className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline print:hidden">{t('adm.d.visit')}</Link>
            )}
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            {admitted && can('admissions.create') && (
              <Button variant="secondary" onClick={() => setModal('transfer')}><ArrowRightLeft className="h-4 w-4" /> {t('adm.transfer.action')}</Button>
            )}
            {admitted && can('admissions.discharge') && (
              <Button onClick={() => { setSummary(''); setSummaryError(''); setModal('discharge'); }}><DoorOpen className="h-4 w-4" /> {t('adm.discharge.action')}</Button>
            )}
            {!admitted && clinical && (
              <Button variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> {t('adm.discharge.print')}</Button>
            )}
          </div>
        </div>
        {!admitted && <p className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600 print:hidden">{t('adm.d.dischargedNote')}</p>}
        {!clinical && <p className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">{t('adm.d.privacy')}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {clinical && (
            <Card title={t('adm.d.reason')}>
              <p className="whitespace-pre-line text-sm text-slate-700">{adm.reason}</p>
            </Card>
          )}

          {clinical && adm.discharge_summary && (
            <Card title={t('adm.d.summary')}>
              <p className="whitespace-pre-line text-sm text-slate-700">{adm.discharge_summary}</p>
            </Card>
          )}

          {clinical && (
            <Card title={t('adm.d.notes')} className="print:hidden">
              {admitted && canAny('encounters.update', 'vitals.create') && (
                <div className="mb-5 space-y-2">
                  <Textarea rows={3} value={note} placeholder={t('adm.d.notePh')} error={noteError}
                    onChange={(e) => { setNote(e.target.value); setNoteError(''); }} />
                  <div className="flex justify-end">
                    <Button onClick={saveNote} loading={busy}>{t('adm.d.addNote')}</Button>
                  </div>
                </div>
              )}
              {adm.notes.length === 0 ? (
                <p className="py-3 text-center text-sm text-slate-500">{t('adm.d.noNotes')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {adm.notes.map((n) => (
                    <li key={n.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge tone={n.note_type === 'progress' ? 'teal' : 'blue'}>{t(`adm.d.${n.note_type === 'progress' ? 'progress' : 'nursing'}`)}</Badge>
                        <span className="font-medium text-slate-700">{n.author_name}</span>
                        <span>{formatDateTime(n.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{n.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="overflow-hidden" title={t('adm.d.history')}>
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('adm.d.bed')}</th>
                    <th className="px-5 py-3">{t('adm.d.from')}</th>
                    <th className="px-5 py-3">{t('adm.d.to')}</th>
                    <th className="px-5 py-3 text-right">{t('adm.col.days')}</th>
                    <th className="px-5 py-3 text-right">{t('adm.d.rate')}</th>
                    <th className="px-5 py-3 text-right">{t('adm.d.charge')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adm.bed_history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-5 py-2.5">
                        <span className="font-mono text-xs font-semibold">{h.bed_number}</span>
                        <p className="text-xs text-slate-400">{wardName(h, i18n.language)}</p>
                        {h.transfer_reason && clinical && <p className="text-xs text-slate-500">{t('adm.d.transferReason')}: {h.transfer_reason}</p>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{formatDateTime(h.assigned_at)}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{h.released_at ? formatDateTime(h.released_at) : '-'}</td>
                      <td className="px-5 py-2.5 text-right">{h.days || '-'}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right">{formatBirr(h.daily_rate)}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium">{h.days ? formatBirr(h.charge) : t('adm.d.noCharge')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={5} className="px-5 py-3 text-right text-sm font-semibold text-slate-600">{t('adm.d.bedTotal')}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-bold text-slate-900">{formatBirr(adm.bed_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6 print:hidden">
          {clinical && (
            <Card title={t('adm.d.allergies')}>
              {adm.allergies.length === 0 ? (
                <p className="text-sm text-slate-500">{t('adm.d.noAllergies')}</p>
              ) : (
                <ul className="space-y-2">
                  {adm.allergies.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-800">{a.allergen}</span>
                      <Badge tone={SEV_TONE[a.severity]}>{t(`patients.sev.${a.severity}`)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {adm.invoice !== undefined && (
            <Card title={t('adm.d.billing')}>
              {adm.invoice ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{adm.invoice.invoice_no}</span>
                    <Badge tone={INV_TONE[adm.invoice.status]}>{t(`bill.status.${adm.invoice.status}`)}</Badge>
                  </div>
                  <p className="text-slate-600">{t('adm.d.balance')}: <strong>{formatBirr(adm.invoice.balance)}</strong></p>
                  <Link to={`/billing/${adm.invoice.id}`} className="inline-block font-medium text-teal-700 hover:underline">{t('adm.d.openInvoice')}</Link>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t('adm.d.noInvoice')}</p>
              )}
            </Card>
          )}
        </div>
      </div>

      {modal === 'transfer' && (
        <TransferModal admission={adm} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}

      <Modal
        open={modal === 'discharge'} onClose={() => setModal(null)} size="lg" title={t('adm.discharge.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>{t('form.cancel')}</Button>
            <Button onClick={doDischarge} loading={busy}>{t('adm.discharge.action')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{adm.patient_name} · {adm.bed_number} · {formatDate(adm.admitted_at)}</p>
          <Textarea
            label={t('adm.discharge.summary')} required rows={6} value={summary} placeholder={t('adm.discharge.summaryPh')} error={summaryError}
            onChange={(e) => { setSummary(e.target.value); setSummaryError(''); }}
          />
          <p className="text-xs text-slate-500">{t('adm.discharge.hint')}</p>
        </div>
      </Modal>
    </div>
  );
}