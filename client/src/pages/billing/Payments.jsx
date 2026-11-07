import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing.api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { fromCents, isMoney, METHODS, NEEDS_REF, toCents } from '../../utils/billing';
import { formatBirr } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

export default function PaymentModal({ invoice, onClose, onPaid }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(invoice.balance.toFixed(2));
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [tendered, setTendered] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const needsRef = NEEDS_REF.includes(method);
  const change = method === 'cash' && isMoney(tendered) && isMoney(amount) && toCents(tendered) >= toCents(amount)
    ? fromCents(toCents(tendered) - toCents(amount)) : null;

  const save = async () => {
    const er = {};
    if (!isMoney(amount) || toCents(amount) <= 0) er.amount = t('bill.pay.invalid');
    else if (toCents(amount) > toCents(invoice.balance)) er.amount = t('bill.pay.over');
    if (needsRef && !reference.trim()) er.reference = t('bill.pay.refRequired');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    setError('');
    try {
      const res = await billingApi.pay(invoice.id, { amount: Number(amount), method, reference: needsRef ? reference : '' });
      toast.success(`${t('bill.msg.paid')}: ${res.data.data.receipt_no}`);
      onPaid(res.data.data);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} title={t('bill.pay.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('bill.pay.confirm')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
          <span className="text-slate-500">{t('bill.pay.balance')}</span>
          <span className="text-lg font-bold text-slate-900">{formatBirr(invoice.balance)}</span>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <Select
          label={t('bill.pay.method')} value={method}
          options={METHODS.map((m) => ({ value: m, label: t(`bill.method.${m}`) }))}
          onChange={(e) => { setMethod(e.target.value); setErrors({}); }}
        />
        <div>
          <Input
            label={t('bill.pay.amount')} required inputMode="decimal" value={amount} error={errors.amount}
            onChange={(e) => { setAmount(e.target.value); setErrors((x) => ({ ...x, amount: undefined })); }}
          />
          <button type="button" onClick={() => setAmount(invoice.balance.toFixed(2))} className="mt-1 text-xs font-medium text-teal-700 hover:underline">
            {t('bill.pay.payFull')}
          </button>
        </div>

        {needsRef && (
          <Input
            label={t('bill.pay.reference')} required value={reference} error={errors.reference} hint={t('bill.pay.referenceHint')}
            onChange={(e) => { setReference(e.target.value); setErrors((x) => ({ ...x, reference: undefined })); }}
          />
        )}

        {method === 'cash' && (
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <Input label={t('bill.pay.tendered')} inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} />
            <p className="pb-2 text-sm text-slate-600">
              {t('bill.pay.change')}: <strong className="text-slate-900">{change === null ? '-' : formatBirr(change)}</strong>
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}