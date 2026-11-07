import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import { encountersApi } from '../../api/encounters.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { FLAG_TONE, LAB_TONE } from '../../utils/constants';
import { formatBirr } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

export default function LabPanel({ enc, canOrder, onChanged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [selected, setSelected] = useState([]);
  const [priority, setPriority] = useState('routine');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingTests(true);
    encountersApi.labTests()
      .then((r) => setTests(r.data.data))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoadingTests(false));
  }, [open]);

  const activeIds = useMemo(
    () => new Set(enc.lab_orders.filter((o) => !['cancelled', 'rejected'].includes(o.status)).map((o) => o.test_id)),
    [enc.lab_orders]
  );

  const grouped = useMemo(() => {
    const g = {};
    tests.forEach((x) => { (g[x.category || '-'] ||= []).push(x); });
    return g;
  }, [tests]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    setBusy(true);
    try {
      await encountersApi.orderLabs(enc.id, { test_ids: selected, priority });
      toast.success(t('consult.lab.ordered'));
      setOpen(false);
      setSelected([]);
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (o) => {
    try {
      await encountersApi.cancelLab(enc.id, o.id);
      toast.success(t('consult.lab.cancelled'));
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Card
      title={t('consult.lab.title')}
      action={canOrder && (
        <Button className="!px-3 !py-1.5" onClick={() => { setSelected([]); setPriority('routine'); setOpen(true); }}>
          <FlaskConical className="h-4 w-4" /> {t('consult.lab.order')}
        </Button>
      )}
    >
      {enc.lab_orders.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">{t('consult.lab.none')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {enc.lab_orders.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{o.name}</span>
                  {o.priority === 'urgent' && <Badge tone="red">{t('consult.lab.urgent')}</Badge>}
                  <Badge tone={LAB_TONE[o.status]}>{t(`consult.lab.status.${o.status}`)}</Badge>
                </div>
                {o.status === 'verified' ? (
                  <p className="mt-1 text-sm text-slate-700">
                    {t('consult.lab.result')}: <strong>{o.result_value}</strong> {o.unit || ''}
                    {o.result_flag && <span className="ml-2"><Badge tone={FLAG_TONE[o.result_flag]}>{t(`consult.lab.flag.${o.result_flag}`)}</Badge></span>}
                    {o.ref_text && <span className="ml-2 text-xs text-slate-400">{t('consult.lab.reference')}: {o.ref_text}</span>}
                    {o.result_comment && <span className="block text-xs text-slate-500">{o.result_comment}</span>}
                  </p>
                ) : o.status === 'rejected' ? (
                  <p className="mt-1 text-sm text-red-600">{o.reject_reason}</p>
                ) : o.status !== 'cancelled' ? (
                  <p className="mt-1 text-xs text-slate-400">{t('consult.lab.result')}: {t('consult.lab.pending')}</p>
                ) : null}
              </div>
              {canOrder && o.status === 'ordered' && (
                <button onClick={() => cancel(o)} className="self-start rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">
                  {t('consult.lab.cancelOrder')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} title={t('consult.lab.orderTitle')} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('form.cancel')}</Button>
            <Button onClick={submit} loading={busy} disabled={!selected.length}>
              {t('consult.lab.confirmOrder', { n: selected.length })}
            </Button>
          </>
        }
      >
        {loadingTests ? <Spinner /> : (
          <div className="space-y-5">
            <Select
              className="sm:w-52" label={t('consult.lab.priority')} value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[{ value: 'routine', label: t('consult.lab.routine') }, { value: 'urgent', label: t('consult.lab.urgent') }]}
            />
            <p className="text-sm font-medium text-slate-700">{t('consult.lab.selectTests')}</p>
            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((x) => {
                    const already = activeIds.has(x.id);
                    const checked = selected.includes(x.id);
                    return (
                      <label
                        key={x.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-sm ${
                          already ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                            : checked ? 'cursor-pointer border-teal-500 bg-teal-50' : 'cursor-pointer border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input type="checkbox" disabled={already} checked={checked} onChange={() => toggle(x.id)} className="h-4 w-4 accent-teal-600" />
                          <span>{x.name}{already && <span className="ml-1 text-xs">({t('consult.lab.alreadyOrdered')})</span>}</span>
                        </span>
                        {x.price != null && <span className="shrink-0 text-xs text-slate-500">{formatBirr(x.price)}</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Card>
  );
}