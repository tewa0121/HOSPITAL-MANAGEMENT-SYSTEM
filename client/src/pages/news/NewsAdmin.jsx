import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { newsApi } from '../../api/requests.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { formatDate } from '../../utils/formatters';

const KINDS = ['news', 'event', 'announcement'];
const KIND_TONE = { news: 'teal', event: 'amber', announcement: 'blue' };
const EMPTY = { kind: 'news', title_en: '', title_am: '', body_en: '', body_am: '', event_date: '', is_published: true };
const errText = (err, fallback) => err.response?.data?.errors?.[0]?.message || err.response?.data?.message || fallback;

export default function NewsAdmin() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null); // null = closed
  const [delTarget, setDelTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    setLoading(true);
    newsApi.list()
      .then((res) => { if (!off) setItems(res.data.data); })
      .catch((err) => toast.error(errText(err, t('login.networkError'))))
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [reload, t]);

  const refresh = () => setReload((n) => n + 1);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openEdit = (p) => setForm({
    ...EMPTY, ...p, title_am: p.title_am || '', body_am: p.body_am || '',
    event_date: p.event_date || '', is_published: !!p.is_published,
  });

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form, event_date: form.kind === 'event' ? form.event_date : '' };
      if (form.id) await newsApi.update(form.id, payload); else await newsApi.create(payload);
      toast.success(t('newsAdmin.saved'));
      setForm(null);
      refresh();
    } catch (err) { toast.error(errText(err, t('login.networkError'))); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await newsApi.remove(delTarget.id);
      toast.success(t('newsAdmin.deleted'));
      setDelTarget(null);
      refresh();
    } catch (err) { toast.error(errText(err, t('login.networkError'))); } finally { setBusy(false); }
  };

  const area = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('newsAdmin.title')}</h1>
          <p className="text-slate-500">{t('newsAdmin.subtitle')}</p>
        </div>
        <Button onClick={() => setForm(EMPTY)}><Plus className="h-4 w-4" /> {t('newsAdmin.new')}</Button>
      </div>

      <Card className="overflow-hidden !p-0">
        {loading ? <Spinner /> : items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('newsAdmin.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[p.kind]}>{t(`newsAdmin.kind.${p.kind}`)}</Badge>
                    {!p.is_published && <Badge tone="slate">{t('newsAdmin.draft')}</Badge>}
                    <span className="text-xs text-slate-400">
                      {formatDate(String(p.published_at).slice(0, 10))}
                      {p.event_date ? ` · ${t('newsAdmin.eventOn')} ${formatDate(p.event_date)}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-semibold text-slate-800">{p.title_en}</p>
                  {p.title_am && <p className="truncate text-sm text-slate-500">{p.title_am}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /> {t('newsAdmin.edit')}</Button>
                  <Button variant="ghost" onClick={() => setDelTarget(p)} className="!text-red-600 hover:!bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!form} onClose={() => setForm(null)} size="lg"
        title={form?.id ? t('newsAdmin.editTitle') : t('newsAdmin.new')}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>{t('form.close')}</Button>
            <Button onClick={save} loading={busy}>{t('newsAdmin.save')}</Button>
          </>
        )}
      >
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t('newsAdmin.type')} value={form.kind} onChange={set('kind')}
                options={KINDS.map((k) => ({ value: k, label: t(`newsAdmin.kind.${k}`) }))}
              />
              {form.kind === 'event' && (
                <Input label={t('newsAdmin.eventDate')} type="date" value={form.event_date} onChange={set('event_date')} />
              )}
            </div>
            <Input label={`${t('newsAdmin.titleField')} (English)`} required value={form.title_en} onChange={set('title_en')} maxLength={200} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('newsAdmin.textField')} (English)<span className="text-red-500"> *</span></label>
              <textarea rows={4} className={area} value={form.body_en} onChange={set('body_en')} maxLength={5000} />
            </div>
            <Input label={`${t('newsAdmin.titleField')} (አማርኛ)`} value={form.title_am} onChange={set('title_am')} maxLength={200} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('newsAdmin.textField')} (አማርኛ)</label>
              <textarea rows={4} className={area} value={form.body_am} onChange={set('body_am')} maxLength={5000} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-teal-600" />
              {t('newsAdmin.published')}
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!delTarget} onClose={() => setDelTarget(null)} size="sm" title={t('form.confirm')}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDelTarget(null)}>{t('form.close')}</Button>
            <Button variant="danger" onClick={remove} loading={busy}>{t('newsAdmin.delete')}</Button>
          </>
        )}
      >
        <p className="text-sm text-slate-600">{t('newsAdmin.deleteAsk', { title: delTarget?.title_en })}</p>
      </Modal>
    </div>
  );
}
