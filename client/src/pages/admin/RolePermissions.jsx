import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { groupPermissions, ROLE_KEY_RE, roleLabel } from '../../utils/admin';
import { errMsg } from '../../utils/errors';

const fieldErrors = (err) => {
  const list = err.response?.data?.errors;
  return Array.isArray(list) ? Object.fromEntries(list.map((x) => [x.field, x.message])) : null;
};

function RoleFormModal({ role, roles, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const isNew = !role;
  const [form, setForm] = useState({
    name: '', display_name: role?.display_name || '', display_name_am: role?.display_name_am || '',
    description: role?.description || '', copy_from: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async () => {
    const er = {};
    if (isNew && !ROLE_KEY_RE.test(form.name.trim().toLowerCase())) er.name = t('admin.roles.form.keyInvalid');
    if (form.display_name.trim().length < 2) er.display_name = t('form.required');
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const payload = { ...form, name: form.name.trim().toLowerCase(), copy_from: form.copy_from ? Number(form.copy_from) : undefined };
      const res = isNew ? await adminApi.createRole(payload) : await adminApi.updateRole(role.id, payload);
      toast.success(t(isNew ? 'admin.roles.created' : 'admin.roles.updated'));
      onSaved(res.data.data);
    } catch (err) {
      const mapped = fieldErrors(err);
      if (mapped) setErrors(mapped); else toast.error(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="lg" title={isNew ? t('admin.roles.form.createTitle') : t('admin.roles.form.editTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew ? (
          <Input label={t('admin.roles.form.key')} required value={form.name} onChange={set('name')} error={errors.name} hint={t('admin.roles.form.keyHint')} />
        ) : (
          <Input label={t('admin.roles.form.key')} value={role.name} disabled readOnly />
        )}
        <Input label={t('admin.roles.form.name')} required value={form.display_name} onChange={set('display_name')} error={errors.display_name} />
        <Input label={t('admin.roles.form.nameAm')} value={form.display_name_am} onChange={set('display_name_am')} />
        <Input label={t('admin.roles.form.description')} value={form.description} onChange={set('description')} error={errors.description} />
        {isNew && (
          <Select
            className="sm:col-span-2" label={t('admin.roles.form.copyFrom')} placeholder={t('admin.roles.form.copyNone')}
            options={roles.map((r) => ({ value: r.id, label: roleLabel(r, i18n.language) }))}
            value={form.copy_from} onChange={set('copy_from')}
          />
        )}
        {isNew && <p className="text-xs text-slate-500 sm:col-span-2">{t('admin.roles.customNote')}</p>}
      </div>
    </Modal>
  );
}

export default function RolePermissions() {
  const { t, i18n } = useTranslation();
  const { can } = usePermission();
  const manage = can('roles.manage');

  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(new Set());
  const [saved, setSaved] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleForm, setRoleForm] = useState(null); // null | 'new' | role
  const [delOpen, setDelOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    adminApi.roles()
      .then((res) => {
        if (off) return;
        setData(res.data.data);
        setSelected((cur) => cur ?? res.data.data.roles[0]?.id ?? null);
      })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [tick, t]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await adminApi.role(id);
      const ids = new Set(res.data.data.permission_ids);
      setSaved(ids);
      setDraft(new Set(ids));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  if (loading || !data) return <Spinner />;

  const role = data.roles.find((r) => r.id === selected);
  const groups = groupPermissions(data.permissions);
  const dashId = data.permissions.find((p) => p.code === 'dashboard.view')?.id;
  const editable = manage && role?.name !== 'super_admin';
  const dirty = draft.size !== saved.size || [...draft].some((id) => !saved.has(id));

  const pick = (id) => {
    if (id === selected) return;
    if (dirty && !window.confirm(t('admin.roles.discard'))) return;
    setSelected(id);
  };

  const toggle = (id) => {
    if (!editable || id === dashId) return;
    setDraft((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleModule = (items) => {
    if (!editable) return;
    const ids = items.map((p) => p.id).filter((id) => id !== dashId);
    setDraft((d) => {
      const n = new Set(d);
      const all = ids.every((id) => n.has(id));
      ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
      return n;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.setRolePermissions(selected, [...draft]);
      toast.success(t('admin.roles.saved'));
      setTick((n) => n + 1);
      await loadDetail(selected);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await adminApi.deleteRole(selected);
      toast.success(t('admin.roles.deleted'));
      setDelOpen(false);
      setSelected(null);
      setTick((n) => n + 1);
    } catch (err) {
      toast.error(errMsg(err));
      setDelOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.roles')}</h1>
          <p className="text-slate-500">{t('admin.roles.subtitle')}</p>
        </div>
        {manage && <Button onClick={() => setRoleForm('new')}><Plus className="h-4 w-4" /> {t('admin.roles.add')}</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-4">
        <div className="space-y-2 lg:col-span-1">
          {data.roles.map((r) => (
            <button
              key={r.id} onClick={() => pick(r.id)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selected === r.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{roleLabel(r, i18n.language)}</span>
                {r.is_system && <Badge tone="slate">{t('admin.roles.system')}</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('admin.roles.usersCount', { n: r.user_count })} · {t('admin.roles.permsCount', { n: r.permission_count })}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 xl:col-span-3">
          {role && (
            <Card
              title={roleLabel(role, i18n.language)}
              action={manage && (
                <div className="flex gap-1">
                  <button onClick={() => setRoleForm(role)} title={t('admin.roles.editNames')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!role.is_system && (
                    <button onClick={() => setDelOpen(true)} title={t('admin.roles.delete')} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            >
              <p className="mb-1 font-mono text-xs text-slate-400">{role.name}</p>
              {role.description && <p className="mb-3 text-sm text-slate-600">{role.description}</p>}
              {!manage && <p className="mb-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">{t('admin.roles.readOnly')}</p>}
              {manage && role.name === 'super_admin' && <p className="mb-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">{t('admin.roles.superLocked')}</p>}

              {detailLoading ? <Spinner /> : (
                <div className="space-y-5">
                  {groups.map((g) => {
                    const ids = g.items.map((p) => p.id);
                    const on = ids.filter((id) => draft.has(id)).length;
                    return (
                      <div key={g.module}>
                        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1">
                          <p className="text-sm font-semibold text-slate-700">
                            {t(`admin.module.${g.module}`, g.module)} <span className="font-normal text-slate-400">({on}/{ids.length})</span>
                          </p>
                          {editable && (
                            <button onClick={() => toggleModule(g.items)} className="text-xs font-medium text-teal-700 hover:underline">
                              {on === ids.length ? t('admin.roles.selectNone') : t('admin.roles.selectAll')}
                            </button>
                          )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {g.items.map((p) => (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${
                                draft.has(p.id) ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200'
                              } ${editable && p.id !== dashId ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <input
                                type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-600"
                                checked={draft.has(p.id)} disabled={!editable || p.id === dashId} onChange={() => toggle(p.id)}
                              />
                              <span>
                                <span className="block font-mono text-xs font-medium text-slate-800">{p.code}</span>
                                <span className="block text-xs text-slate-500">{p.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {editable && (
                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-500">
                        <p>{t('admin.roles.dashLocked')}</p>
                        <p>{t('admin.roles.appliesTo', { n: role.user_count })}</p>
                      </div>
                      <Button onClick={save} loading={saving} disabled={!dirty}>{t('admin.roles.save')}</Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {roleForm && (
        <RoleFormModal
          role={roleForm === 'new' ? null : roleForm} roles={data.roles} onClose={() => setRoleForm(null)}
          onSaved={(r) => { setRoleForm(null); setTick((n) => n + 1); if (roleForm === 'new' && r?.id) setSelected(r.id); }}
        />
      )}

      <Modal
        open={delOpen} onClose={() => setDelOpen(false)} size="sm" title={t('admin.roles.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDelOpen(false)}>{t('form.cancel')}</Button>
            <Button variant="danger" onClick={remove} loading={saving} disabled={role?.user_count > 0}>{t('admin.roles.delete')}</Button>
          </>
        }
      >
        {role && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>{t('admin.roles.deleteMsg', { name: roleLabel(role, i18n.language) })}</p>
            {role.user_count > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{t('admin.roles.deleteBlocked')}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}