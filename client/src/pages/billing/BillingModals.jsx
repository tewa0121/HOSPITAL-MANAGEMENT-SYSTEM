import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing.api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { fromCents, isMoney, METHODS, toCents } from '../../utils/billing';
import { formatBirr } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const Banner = ({ children }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{children}</div>
);

// ---------------- Discount (hospital administrator only) ----------------
export function DiscountModal({ invoice, onClose, onSaved }) {
  const { t } = useTranslation();
  const [type, setType] = useState('amount');
  const [value, setValue] = useState(invoice.discount > 0 ? invoice.discount.toFixed(2) : '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const subC = toCents(invoice.subtotal);
  const paidC = toCents(invoice.amount_paid);
  const valid = value !== '' && isMoney(value) && (type === 'amount' || Number(value) <= 100);
  const discC = !valid ? null : type === 'percent' ? Math.round((subC * Number(value)) / 100) : toCents(value);
  const problem = discC === null ? null : discC > subC ? t('bill.disc.exceeds') : subC - discC < paidC ? t('bill.disc.belowPaid') : null;

  const save = async () => {
    const er = {};
    if (!valid) er.value = t('bill.disc.invalid');
    else if (problem) er.value = problem;
    if (reason.trim().length < 3) er.reason = t('bill.disc.reasonRequired');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    setError('');
    try {
      await billingApi.discount(invoice.id, { type, value: Number(value), reason });
      toast.success(t('bill.msg.discount'));
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} title={t('bill.disc.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t('bill.d.subtotal')}: <strong>{formatBirr(invoice.subtotal)}</strong></p>
        {error && <Banner>{error}</Banner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('bill.disc.type')} value={type}
            options={[{ value: 'amount', label: t('bill.disc.amount') }, { value: 'percent', label: t('bill.disc.percent') }]}
            onChange={(e) => { setType(e.target.value); setErrors({}); }}
          />
          <Input
            label={t('bill.disc.value')} required inputMode="decimal" value={value} error={errors.value}
            onChange={(e) => { setValue(e.target.value); setErrors((x) => ({ ...x, value: undefined })); }}
          />
        </div>
        {discC !== null && !problem && (
          <p className="text-sm text-slate-600">
            {t('bill.disc.newDiscount')}: <strong>{formatBirr(fromCents(discC))}</strong> · {t('bill.disc.newTotal')}: <strong>{formatBirr(fromCents(subC - discC))}</strong>
          </p>
        )}
        <Input
          label={t('bill.disc.reason')} required value={reason} error={errors.reason} placeholder={t('bill.disc.reasonPh')}
          onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })); }}
        />
        <p className="text-xs text-slate-500">{t('bill.disc.hint')}</p>
      </div>
    </Modal>
  );
}

// ---------------- Refund (hospital administrator only) ----------------
export function RefundModal({ invoice, onClose, onSaved }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const er = {};
    if (!isMoney(amount) || toCents(amount) <= 0) er.amount = t('bill.pay.invalid');
    else if (toCents(amount) > toCents(invoice.amount_paid)) er.amount = t('bill.ref.exceeds');
    if (reason.trim().length < 3) er.reason = t('bill.disc.reasonRequired');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    setError('');
    try {
      const res = await billingApi.refund(invoice.id, { amount: Number(amount), method, reason });
      toast.success(`${t('bill.msg.refunded')}: ${res.data.data.receipt_no}`);
      onSaved(res.data.data);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} title={t('bill.ref.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button variant="danger" onClick={save} loading={busy}>{t('bill.ref.confirm')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t('bill.ref.paid')}: <strong>{formatBirr(invoice.amount_paid)}</strong></p>
        {error && <Banner>{error}</Banner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('bill.ref.amount')} required inputMode="decimal" value={amount} error={errors.amount}
            onChange={(e) => { setAmount(e.target.value); setErrors((x) => ({ ...x, amount: undefined })); }}
          />
          <Select
            label={t('bill.ref.method')} value={method}
            options={METHODS.map((m) => ({ value: m, label: t(`bill.method.${m}`) }))}
            onChange={(e) => setMethod(e.target.value)}
          />
        </div>
        <Input
          label={t('bill.ref.reason')} required value={reason} error={errors.reason} placeholder={t('bill.ref.reasonPh')}
          onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })); }}
        />
        <p className="text-xs text-slate-500">{t('bill.ref.hint')}</p>
      </div>
    </Modal>
  );
}

// ---------------- Cancel invoice ----------------
export function CancelModal({ invoice, onClose, onSaved }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (reason.trim().length < 3) return setError(t('bill.disc.reasonRequired'));
    setBusy(true);
    try {
      await billingApi.cancel(invoice.id, reason);
      toast.success(t('bill.msg.cancelled'));
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="sm" title={t('bill.cancel.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.close')}</Button>
          <Button variant="danger" onClick={save} loading={busy}>{t('bill.cancel.confirm')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{invoice.invoice_no} · {invoice.patient_name}</p>
        <p className="text-sm text-slate-600">{t('bill.cancel.msg')}</p>
        <Input
          label={t('bill.cancel.reason')} required value={reason} error={error} placeholder={t('bill.cancel.reasonPh')}
          onChange={(e) => { setReason(e.target.value); setError(''); }}
        />
      </div>
    </Modal>
  );
}

// ---------------- Add a service (procedure, dressing, injection...) ----------------
export function AddServiceModal({ invoice, lang, onClose, onSaved }) {
  const { t } = useTranslation();
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [qty, setQty] = useState('1');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    billingApi.services().then((r) => setServices(r.data.data)).catch((err) => toast.error(errMsg(err)));
  }, []);

  const save = async () => {
    const er = {};
    if (!serviceId) er.service = t('form.required');
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1 || n > 100) er.qty = t('form.required');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      await billingApi.addItem(invoice.id, { service_id: Number(serviceId), quantity: n });
      toast.success(t('bill.msg.added'));
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const options = services.map((s) => ({
    value: s.id,
    label: `${lang === 'am' && s.name_am ? s.name_am : s.name} - ${formatBirr(s.price)}`,
  }));

  return (
    <Modal
      open onClose={onClose} title={t('bill.svc.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('bill.svc.service')} required placeholder={t('bill.svc.select')} options={options}
          value={serviceId} error={errors.service}
          onChange={(e) => { setServiceId(e.target.value); setErrors((x) => ({ ...x, service: undefined })); }}
        />
        <Input
          label={t('bill.svc.qty')} required type="number" min="1" max="100" value={qty} error={errors.qty}
          onChange={(e) => { setQty(e.target.value); setErrors((x) => ({ ...x, qty: undefined })); }}
        />
        <p className="text-xs text-slate-500">{t('bill.svc.hint')}</p>
      </div>
    </Modal>
  );
}