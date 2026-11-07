import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { EMAIL_RE, groupPermissions, roleLabel, USERNAME_RE } from '../../utils/admin';
import { PHONE_RE } from '../../utils/constants';
import { errMsg } from '../../utils/errors';

const fieldErrors = (err) => {
  const list = err.response?.data?.errors;
  return Array.isArray(list) ? Object.fromEntries(list.map((x) => [x.field, x.message])) : null;
};

// ---------------- Create or edit a user ----------------
export function UserFormModal({ user, lookups, meId, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const isNew = !user;
  const isSelf = !!user && user.id === meId;
  const [form, setForm] = useState({
    full_name: user?.full_name || '', username: '', email: user?.email || '', phone: user?.phone || '',
    role_id: user ? String(user.role_id) : '', department_id: user?.department_id ? String(user.department_id) : '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const doctorRole = lookups.roles.find((r) => r.name === 'doctor');
  const isDoctor = !!doctorRole && String(doctorRole.id) === String(form.role_id);
  const roleChanged = !!user && String(user.role_id) !== String(form.role_id);

  const save = async () => {
    const er = {};
    const req = t('form.required');
    if (form.full_name.trim().length < 3) er.full_name = t('admin.users.form.nameShort');
    if (isNew && !USERNAME_RE.test(form.username.trim().toLowerCase())) er.username = t('admin.users.form.usernameInvalid');
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) er.email = t('admin.users.form.emailInvalid');
    if (form.phone.trim() && !PHONE_RE.test(form.phone.replace(/[\s-]/g, ''))) er.phone = t('admin.users.form.phoneInvalid');
    if (!form.role_id) er.role_id = req;
    if (isDoctor && !form.department_id) er.department_id = t('admin.users.form.deptRequired');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const payload = {
        ...form, username: form.username.trim().toLowerCase(),
        role_id: Number(form.role_id), department_id: form.department_id ? Number(form.department_id) : null,
      };
      const res = isNew ? await adminApi.createUser(payload) : await adminApi.updateUser(user.id, payload);
      toast.success(isNew ? t('admin.users.form.created') : t('admin.users.form.saved'));
      onSaved(res.data.data);
    } catch (err) {
      const mapped = fieldErrors(err);
      if (mapped) setErrors(mapped); else toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const roleOpts = lookups.roles.map((r) => ({ value: r.id, label: roleLabel(r, i18n.language) }));
  const deptOpts = lookups.departments.map((d) => ({ value: d.id, label: i18n.language === 'am' && d.name_am ? d.name_am : d.name }));

  return (
    <Modal
      open onClose={onClose} size="lg" title={isNew ? t('admin.users.form.createTitle') : t('admin.users.form.editTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('form.save')}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input className="sm:col-span-2" label={t('admin.users.form.fullName')} required value={form.full_name}
          onChange={set('full_name')} error={errors.full_name} />
        {isNew ? (
          <Input label={t('admin.users.form.username')} required value={form.username} onChange={set('username')}
            error={errors.username} hint={t('admin.users.form.usernameHint')} autoComplete="off" />
        ) : (
          <Input label={t('admin.users.form.username')} value={user.username} disabled readOnly />
        )}
        <Input label={t('admin.users.form.email')} value={form.email} onChange={set('email')} error={errors.email} />
        <Input label={t('admin.users.form.phone')} value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="09XXXXXXXX" />
        <Select label={t('admin.users.form.role')} required placeholder={t('form.select')} options={roleOpts}
          value={form.role_id} onChange={set('role_id')} error={errors.role_id} disabled={isSelf} />
        <Select label={t('admin.users.form.department')} required={isDoctor} placeholder={t('admin.users.form.noDepartment')}
          options={deptOpts} value={form.department_id} onChange={set('department_id')} error={errors.department_id} />

        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs text-slate-500">{t('admin.users.form.deptHint')}</p>
          {isSelf && <p className="text-xs text-slate-500">{t('admin.users.form.selfRole')}</p>}
          {roleChanged && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('admin.users.form.roleChangeWarn')}</p>}
          {isNew && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{t('admin.users.form.tempNote')}</p>}
        </div>
      </div>
    </Modal>
  );
}

// ---------------- The temporary password (shown once) ----------------
export function TempPasswordModal({ username, password, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the password is also on screen */ }
  };

  return (
    <Modal
      open onClose={onClose} size="sm" title={t('admin.users.temp.title')}
      footer={<Button onClick={onClose}>{t('admin.users.temp.done')}</Button>}
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">{t('admin.users.temp.intro')}</p>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t('admin.users.temp.username')}</p>
          <p className="font-mono text-base font-semibold text-slate-800">{username}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">{t('admin.users.temp.password')}</p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xl font-bold tracking-wider text-slate-900">{password}</p>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('admin.users.temp.copied') : t('admin.users.temp.copy')}
            </button>
          </div>
        </div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{t('admin.users.temp.warn')}</p>
      </div>
    </Modal>
  );
}

// ---------------- Per-user permission overrides (roles.manage only) ----------------
export function PermissionOverridesModal({ user, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [state, setState] = useState({}); // permission id -> 'inherit' | 'grant' | 'revoke'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.userPermissions(user.id)
      .then((res) => {
        const d = res.data.data;
        setData(d);
        const s = {};
        d.permissions.forEach((p) => { s[p.id] = p.override || 'inherit'; });
        setState(s);
      })
      .catch((err) => { toast.error(errMsg(err)); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const effective = (p) => (state[p.id] === 'grant' ? true : state[p.id] === 'revoke' ? false : p.from_role);
  const changes = Object.values(state).filter((v) => v !== 'inherit').length;

  const save = async () => {
    setBusy(true);
    try {
      const overrides = Object.entries(state)
        .filter(([, v]) => v !== 'inherit')
        .map(([id, v]) => ({ permission_id: Number(id), is_granted: v === 'grant' }));
      await adminApi.setUserPermissions(user.id, overrides);
      toast.success(t('admin.users.perm.saved'));
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const mark = (on) => (on ? <Check className="mx-auto h-4 w-4 text-green-600" /> : <span className="block text-center text-slate-300">-</span>);

  return (
    <Modal
      open onClose={onClose} size="lg" title={`${t('admin.users.perm.title')}: ${user.full_name}`}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-slate-500">{t('admin.users.perm.changes', { n: changes })}</span>
          <Button variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button onClick={save} loading={busy} disabled={!data || data.user.privileged}>{t('form.save')}</Button>
        </>
      }
    >
      {!data ? <Spinner /> : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {roleLabel({ display_name: data.user.role_display, display_name_am: data.user.role_display_am }, i18n.language)} · {t('admin.users.perm.intro')}
          </p>
          {data.user.privileged && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">{t('admin.users.perm.privileged')}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t('admin.users.perm.permission')}</th>
                  <th className="px-3 py-2 text-center">{t('admin.users.perm.roleDefault')}</th>
                  <th className="px-3 py-2">{t('admin.users.perm.override')}</th>
                  <th className="px-3 py-2 text-center">{t('admin.users.perm.effective')}</th>
                </tr>
              </thead>
              <tbody>
                {groupPermissions(data.permissions).map((g) => (
                  <FragmentRows key={g.module} title={t(`admin.module.${g.module}`, g.module)}>
                    {g.items.map((p) => (
                      <tr key={p.id} className={`border-t border-slate-100 ${state[p.id] !== 'inherit' ? 'bg-amber-50/60' : ''}`}>
                        <td className="px-3 py-2">
                          <p className="font-mono text-xs font-medium text-slate-800">{p.code}</p>
                          <p className="text-xs text-slate-400">{p.description}</p>
                        </td>
                        <td className="px-3 py-2">{mark(p.from_role)}</td>
                        <td className="px-3 py-2">
                          {p.code === 'dashboard.view' ? (
                            <Badge tone="slate">{t('admin.users.perm.dashLocked')}</Badge>
                          ) : (
                            <select
                              value={state[p.id]} disabled={data.user.privileged}
                              onChange={(e) => setState((s) => ({ ...s, [p.id]: e.target.value }))}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-teal-500"
                            >
                              <option value="inherit">{t('admin.users.perm.inherit')}</option>
                              {p.from_role
                                ? <option value="revoke">{t('admin.users.perm.revoke')}</option>
                                : <option value="grant">{t('admin.users.perm.grant')}</option>}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2">{mark(effective(p))}</td>
                      </tr>
                    ))}
                  </FragmentRows>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function FragmentRows({ title, children }) {
  return (
    <>
      <tr className="bg-slate-100"><td colSpan={4} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</td></tr>
      {children}
    </>
  );
}