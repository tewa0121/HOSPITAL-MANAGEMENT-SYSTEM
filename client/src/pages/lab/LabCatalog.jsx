import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { labApi } from '../../api/lab.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { formatBirr } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const EMPTY = {
  code: '', name: '', category: '', specimen: '', unit: '', ref_low: '', ref_high: '',
  ref_text: '', price: '', is_active: true,
};

export default function LabCatalog() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, 'new' or a test
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    labApi.catalog()
      .then((res) => setItems(res.data.data))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const isNew = editing === 'new';

  const openNew = () => { setForm(EMPTY); setErrors({}); setEditing('new'); };
  const openEdit = (x) => {
    setForm({
      code: x.code, name: x.name, category: x.category || '', specimen: x.specimen || '', unit: x.unit || '',
      ref_low: x.ref_low ?? '', ref_high: x.ref_high ?? '', ref_text: x.ref_text || '',
      price: x.price ?? '', is_active: !!x.is_active,
    });
    setErrors({});
    setEditing(x);
  };

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };

  const save = async () => {
    const er = {};
    const req = t('form.required');
    if (isNew && !/^[A-Za-z0-9]{2,12}$/.test(form.code.trim())) er.code = t('lab.catalog.codeHint');
    if (!form.name.trim()) er.name = req;
    if (form.price === '' || Number(form.price) < 0) er.price = req;
    if (form.ref_low !== '' && form.ref_high !== '' && Number(form.ref_low) > Number(form.ref_high)) {
      er.ref_high = t('lab.catalog.refHint');
    }
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      if (isNew) await labApi.createTest(form);
      else await labApi.updateTest(editing.id, form);
      toast.success(t('lab.catalog.saved'));
      setEditing(null);
      load();
    } catch (err) {
      const list = err.response?.data?.errors;
      if (Array.isArray(list)) setErrors(Object.fromEntries(list.map((x) => [x.field, x.message])));
      else toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <Card
      className="overflow-hidden"
      title={t('lab.tab.catalog')}
      action={<Button className="!px-3 !py-1.5" onClick={openNew}><Plus className="h-4 w-4" /> {t('lab.catalog.add')}</Button>}
    >
      <div className="-mx-5 -mb-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">{t('lab.catalog.code')}</th>
              <th className="px-5 py-3">{t('lab.catalog.name')}</th>
              <th className="px-5 py-3">{t('lab.catalog.specimen')}</th>
              <th className="px-5 py-3">{t('lab.catalog.reference')}</th>
              <th className="px-5 py-3">{t('lab.catalog.price')}</th>
              <th className="px-5 py-3">{t('lab.col.status')}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((x) => (
              <tr key={x.id} className={x.is_active ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'}>
                <td className="px-5 py-3 font-mono text-xs">{x.code}</td>
                <td className="px-5 py-3">
                  <p className="font-medium">{x.name}</p>
                  <p className="text-xs text-slate-400">{x.category || '-'}</p>
                </td>
                <td className="px-5 py-3">{x.specimen || '-'}</td>
                <td className="px-5 py-3">{x.ref_text || '-'} {x.unit || ''}</td>
                <td className="whitespace-nowrap px-5 py-3">{x.price != null ? formatBirr(x.price) : '-'}</td>
                <td className="px-5 py-3"><Badge tone={x.is_active ? 'green' : 'slate'}>{x.is_active ? t('lab.catalog.active') : t('lab.catalog.inactive')}</Badge></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => openEdit(x)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing} onClose={() => setEditing(null)} size="lg"
        title={isNew ? t('lab.catalog.add') : t('lab.catalog.edit')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>{t('form.cancel')}</Button>
            <Button onClick={save} loading={busy}>{t('form.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('lab.catalog.code')} required disabled={!isNew} value={form.code} onChange={set('code')} error={errors.code} hint={isNew ? t('lab.catalog.codeHint') : ''} />
          <Input label={t('lab.catalog.name')} required value={form.name} onChange={set('name')} error={errors.name} />
          <Input label={t('lab.catalog.category')} value={form.category} onChange={set('category')} />
          <Input label={t('lab.catalog.specimen')} value={form.specimen} onChange={set('specimen')} />
          <Input label={t('lab.catalog.unit')} value={form.unit} onChange={set('unit')} />
          <Input label={t('lab.catalog.price')} required type="number" min="0" step="0.01" value={form.price} onChange={set('price')} error={errors.price} />
          <Input label={t('lab.catalog.refLow')} type="number" step="any" value={form.ref_low} onChange={set('ref_low')} error={errors.ref_low} />
          <Input label={t('lab.catalog.refHigh')} type="number" step="any" value={form.ref_high} onChange={set('ref_high')} error={errors.ref_high} />
          <Input className="sm:col-span-2" label={t('lab.catalog.refText')} value={form.ref_text} onChange={set('ref_text')} hint={t('lab.catalog.refHint')} />
          {!isNew && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              {t('lab.catalog.active')}
            </label>
          )}
        </div>
      </Modal>
    </Card>
  );
}