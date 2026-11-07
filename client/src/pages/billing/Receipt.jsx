import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, HeartPulse, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing.api';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { formatBirr, formatDateTime } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value || '-'}</span>
    </div>
  );
}

export default function Receipt() {
  const { t } = useTranslation();
  const { id, paymentId } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);

  useEffect(() => {
    billingApi.get(id)
      .then((res) => {
        const data = res.data.data;
        if (!data.payments.some((p) => String(p.id) === paymentId)) {
          toast.error('Receipt not found');
          navigate(`/billing/${id}`, { replace: true });
        } else setInv(data);
      })
      .catch((err) => { toast.error(errMsg(err)); navigate('/billing', { replace: true }); });
  }, [id, paymentId, navigate]);

  if (!inv) return <Spinner />;

  const pay = inv.payments.find((p) => String(p.id) === paymentId);
  const refund = pay.amount < 0;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/billing/${inv.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700">
          <ArrowLeft className="h-4 w-4" /> {t('bill.act.backInvoice')}
        </Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> {t('bill.receipt.print')}</Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-col items-center border-b border-dashed border-slate-300 pb-4 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 print:hidden">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>
          <p className="text-lg font-bold text-slate-900">{t('app.hospital')}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {refund ? t('bill.receipt.refundTitle') : t('bill.receipt.title')}
          </p>
          <p className="mt-1 font-mono text-sm text-slate-700">{pay.receipt_no}</p>
        </div>

        <div className="divide-y divide-slate-100 py-3">
          <Row label={t('bill.d.when')} value={formatDateTime(pay.paid_at)} />
          <Row label={t('bill.receipt.patient')} value={inv.patient_name} />
          <Row label={t('bill.receipt.mrn')} value={inv.mrn} />
          <Row label={t('bill.receipt.invoice')} value={inv.invoice_no} />
          <Row label={t('bill.d.method')} value={t(`bill.method.${pay.method}`)} />
          {pay.reference && <Row label={t('bill.d.reference')} value={pay.reference} />}
          <Row label={t('bill.d.receivedBy')} value={pay.received_by_name} />
        </div>

        <div className="rounded-lg bg-slate-50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t('bill.receipt.amount')}</p>
          <p className={`text-3xl font-bold ${refund ? 'text-red-600' : 'text-slate-900'}`}>{formatBirr(pay.amount)}</p>
        </div>

        <div className="mt-3">
          <Row label={t('bill.receipt.balanceAfter')} value={formatBirr(inv.balance)} />
        </div>

        <p className="mt-4 border-t border-dashed border-slate-300 pt-4 text-center text-xs text-slate-500">
          {t('bill.receipt.thanks')}. {t('bill.receipt.keep')}
        </p>
      </div>
    </div>
  );
}