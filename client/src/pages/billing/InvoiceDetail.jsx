import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Banknote, BadgePercent, Plus, Printer, RefreshCw, Trash2, Undo2, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import PaymentModal from './Payments';
import { AddServiceModal, CancelModal, DiscountModal, RefundModal } from './BillingModals';
import { INV_TONE } from '../../utils/billing';
import { formatBirr, formatDateTime } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

function Line({ label, value, strong, tone = '' }) {
  return (
    <div className={`flex justify-between gap-6 py-1.5 text-sm ${strong ? 'text-base font-bold' : ''} ${tone}`}>
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

export default function InvoiceDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'pay' | 'discount' | 'refund' | 'cancel' | 'service'
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await billingApi.get(id);
      setInv(res.data.data);
    } catch (err) {
      toast.error(errMsg(err, 'Error'));
      navigate('/billing', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading || !inv) return <Spinner />;

  const active = inv.status !== 'cancelled';
  const canCreate = can('billing.invoice_create');
  const showPay = can('billing.payment_create') && active && inv.balance > 0;
  const showRefund = can('billing.refund') && active && inv.amount_paid > 0;
  const showCancel = canCreate && active && inv.amount_paid === 0;
  const done = () => { setModal(null); load(); };

  const sync = async () => {
    setBusy(true);
    try {
      const r = (await billingApi.sync(id)).data.data;
      if (!r.added && !r.updated && !r.removed) toast(t('bill.msg.upToDate'));
      else toast.success(t('bill.msg.synced', r));
      await load();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const removeItem = async (item) => {
    try {
      await billingApi.removeItem(id, item.id);
      toast.success(t('bill.msg.removed'));
      await load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="space-y-6">
      <Link to="/billing" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 print:hidden">
        <ArrowLeft className="h-4 w-4" /> {t('bill.act.back')}
      </Link>

      {/* only visible on paper */}
      <div className="hidden text-center print:block">
        <p className="text-xl font-bold">{t('app.hospital')}</p>
        <p className="text-sm text-slate-500">{t('bill.col.invoice')} {inv.invoice_no}</p>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-xl font-bold text-slate-900">{inv.invoice_no}</h1>
              <Badge tone={INV_TONE[inv.status]}>{t(`bill.status.${inv.status}`)}</Badge>
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-800">{inv.patient_name}</p>
            <p className="text-sm text-slate-500">
              <span className="font-mono">{inv.mrn}</span> · {inv.patient_phone || '-'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t('bill.d.created')}: {formatDateTime(inv.created_at)} · {t('bill.d.createdBy')}: {inv.created_by_name || '-'}
            </p>
            {inv.encounter_id && can('encounters.read') && (
              <Link to={`/opd/${inv.encounter_id}`} className="mt-1 inline-block text-sm font-medium text-teal-700 hover:underline print:hidden">
                {t('bill.d.visit')}
              </Link>
            )}
            {inv.admission_id && can('admissions.read') && (
              <Link to={`/admissions/${inv.admission_id}`} className="mt-1 inline-block text-sm font-medium text-teal-700 hover:underline print:hidden">
                {t('bill.act.openAdmission')}
              </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            {showPay && <Button onClick={() => setModal('pay')}><Banknote className="h-4 w-4" /> {t('bill.act.pay')}</Button>}
            {canCreate && active && (inv.encounter_id || inv.admission_id) && (
              <Button variant="secondary" onClick={sync} loading={busy}><RefreshCw className="h-4 w-4" /> {t('bill.act.sync')}</Button>
            )}
            {canCreate && active && (
              <Button variant="secondary" onClick={() => setModal('service')}><Plus className="h-4 w-4" /> {t('bill.act.addService')}</Button>
            )}
            {can('billing.discount_apply') && active && (
              <Button variant="secondary" onClick={() => setModal('discount')}><BadgePercent className="h-4 w-4" /> {t('bill.act.discount')}</Button>
            )}
            {showRefund && (
              <Button variant="secondary" onClick={() => setModal('refund')}><Undo2 className="h-4 w-4" /> {t('bill.act.refund')}</Button>
            )}
            <Button variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> {t('bill.act.print')}</Button>
            {showCancel && (
              <Button variant="ghost" className="!text-red-600" onClick={() => setModal('cancel')}><XCircle className="h-4 w-4" /> {t('bill.act.cancel')}</Button>
            )}
          </div>
        </div>

        {!active && <p className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">{t('bill.d.cancelledNote')}</p>}
        {active && inv.status === 'paid' && <p className="mt-4 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">{t('bill.d.paidNote')}</p>}
      </Card>

      <Card className="overflow-hidden" title={t('bill.d.items')}>
        <div className="-mx-5 -mb-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{t('bill.d.description')}</th>
                <th className="px-5 py-3 text-right">{t('bill.d.qty')}</th>
                <th className="px-5 py-3 text-right">{t('bill.d.unitPrice')}</th>
                <th className="px-5 py-3 text-right">{t('bill.d.amount')}</th>
                <th className="px-5 py-3 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inv.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-5 py-2.5">
                    <span className="font-medium text-slate-800">{it.description}</span>
                    <span className="ml-2 text-xs text-slate-400">{t(`bill.d.type.${it.reference_type || 'other'}`)}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right">{it.quantity}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right">{formatBirr(it.unit_price)}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium">{formatBirr(it.line_total)}</td>
                  <td className="px-5 py-2.5 text-right print:hidden">
                    {canCreate && active && it.reference_type === 'other' && (
                      <button title={t('bill.d.removeItem')} onClick={() => removeItem(it)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canCreate && active && <p className="mt-6 text-xs text-slate-400 print:hidden">{t('bill.d.autoNote')}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2" title={t('bill.d.payments')}>
          {inv.payments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">{t('bill.d.noPayments')}</p>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('bill.d.receipt')}</th>
                    <th className="px-5 py-3">{t('bill.d.method')}</th>
                    <th className="px-5 py-3 text-right">{t('bill.d.amount')}</th>
                    <th className="px-5 py-3">{t('bill.d.receivedBy')}</th>
                    <th className="px-5 py-3">{t('bill.d.when')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inv.payments.map((p) => (
                    <tr key={p.id} className={p.amount < 0 ? 'bg-red-50' : ''}>
                      <td className="whitespace-nowrap px-5 py-2.5">
                        <Link to={`/billing/${inv.id}/receipt/${p.id}`} className="font-mono text-xs font-medium text-teal-700 hover:underline">{p.receipt_no}</Link>
                      </td>
                      <td className="px-5 py-2.5">
                        {t(`bill.method.${p.method}`)}
                        {p.reference && <p className="text-xs text-slate-400">{p.reference}</p>}
                      </td>
                      <td className={`whitespace-nowrap px-5 py-2.5 text-right font-semibold ${p.amount < 0 ? 'text-red-600' : ''}`}>{formatBirr(p.amount)}</td>
                      <td className="px-5 py-2.5">{p.received_by_name}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{formatDateTime(p.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <Line label={t('bill.d.subtotal')} value={formatBirr(inv.subtotal)} />
          {inv.discount > 0 && (
            <Line
              label={`${t('bill.d.discount')}${inv.discount_approved_by_name ? ` (${t('bill.d.approvedBy')}: ${inv.discount_approved_by_name})` : ''}`}
              value={`- ${formatBirr(inv.discount)}`} tone="text-amber-700"
            />
          )}
          <div className="my-1 border-t border-slate-200" />
          <Line label={t('bill.d.total')} value={formatBirr(inv.total)} strong />
          <Line label={t('bill.d.paid')} value={formatBirr(inv.amount_paid)} />
          <Line label={t('bill.d.balance')} value={active ? formatBirr(inv.balance) : '-'} strong tone={inv.balance > 0 && active ? 'text-red-600' : ''} />
        </Card>
      </div>

      {modal === 'pay' && <PaymentModal invoice={inv} onClose={() => setModal(null)} onPaid={(r) => navigate(`/billing/${inv.id}/receipt/${r.payment_id}`)} />}
      {modal === 'discount' && <DiscountModal invoice={inv} onClose={() => setModal(null)} onSaved={done} />}
      {modal === 'refund' && <RefundModal invoice={inv} onClose={() => setModal(null)} onSaved={(r) => navigate(`/billing/${inv.id}/receipt/${r.payment_id}`)} />}
      {modal === 'cancel' && <CancelModal invoice={inv} onClose={() => setModal(null)} onSaved={done} />}
      {modal === 'service' && <AddServiceModal invoice={inv} lang={i18n.language} onClose={() => setModal(null)} onSaved={done} />}
    </div>
  );
}