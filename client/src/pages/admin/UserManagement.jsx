import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lock, Pencil, Plus, Search, ShieldCheck, Unlock, UserCheck, UserX, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import { PermissionOverridesModal, TempPasswordModal, UserFormModal } from './UserModals';
import { deptLabel, roleLabel } from '../../utils/admin';
import { formatDateTime } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const LIMIT = 10;
const iconBtn = 'rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-teal-700';

export default function UserManagement() {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const { can } = usePermission();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, summary: null });
  const [lookups, setLookups] = useState({ roles: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [form, setForm] = useState(null);       // null | 'new' | user
  const [confirm, setConfirm] = useState(null); // { action, user }
  const [temp, setTemp] = useState(null);
  const [permFor, setPermFor] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    adminApi.userLookups().then((r) => setLookups(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let off = false;
    adminApi.users({ search: query, role_id: roleId, status, page, limit: LIMIT })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [query, roleId, status, page, tick, t]);

  const reload = () => setTick((n) => n + 1);

  const unlock = async (u) => {
    try {
      await adminApi.unlockUser(u.id);
      toast.success(t('admin.users.msg.unlocked'));
      reload();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const runConfirm = async () => {
    const { action, user } = confirm;
    setBusy(true);
    try {
      if (action === 'reset') {
        const res = await adminApi.resetPassword(user.id);
        setTemp({ username: user.username, password: res.data.data.temporary_password });
      } else {
        await adminApi.setUserStatus(user.id, action === 'activate');
        toast.success(t(action === 'activate' ? 'admin.users.msg.activated' : 'admin.users.msg.deactivated'));
      }
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const s = data.summary;
  const canUpdate = can('users.update');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.users')}</h1>
          <p className="text-slate-500">{t('admin.users.subtitle')}</p>
        </div>
        {can('users.create') && <Button onClick={() => setForm('new')}><Plus className="h-4 w-4" /> {t('admin.users.add')}</Button>}
      </div>

      {s && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} color="teal" label={t('admin.users.sum.total')} value={s.total} />
          <StatCard icon={UserCheck} color="blue" label={t('admin.users.sum.active')} value={s.active} />
          <StatCard icon={UserX} color="violet" label={t('admin.users.sum.inactive')} value={s.inactive} />
          <StatCard icon={Lock} color="amber" label={t('admin.users.sum.locked')} value={s.locked} />
        </div>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="relative lg:w-80">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.users.searchPh')}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <Select className="lg:w-52" value={roleId} placeholder={t('admin.users.allRoles')}
            options={lookups.roles.map((r) => ({ value: r.id, label: roleLabel(r, i18n.language) }))}
            onChange={(e) => { setLoading(true); setPage(1); setRoleId(e.target.value); }} />
          <Select className="lg:w-48" value={status} placeholder={t('admin.users.allStatuses')}
            options={['active', 'inactive', 'locked'].map((k) => ({ value: k, label: t(`admin.users.status.${k}`) }))}
            onChange={(e) => { setLoading(true); setPage(1); setStatus(e.target.value); }} />
        </div>

        {loading ? <Spinner /> : data.items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('admin.users.empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t('admin.users.col.user')}</th>
                    <th className="px-5 py-3">{t('admin.users.col.role')}</th>
                    <th className="px-5 py-3">{t('admin.users.col.department')}</th>
                    <th className="px-5 py-3">{t('admin.users.col.status')}</th>
                    <th className="px-5 py-3">{t('admin.users.col.lastLogin')}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((u) => {
                    const editable = canUpdate && !u.protected;
                    return (
                      <tr key={u.id} className={u.is_active ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{u.full_name}</span>
                            {u.is_self && <Badge tone="teal">{t('admin.users.you')}</Badge>}
                          </div>
                          <p className="text-xs text-slate-400">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
                        </td>
                        <td className="px-5 py-3">{roleLabel(u, i18n.language)}</td>
                        <td className="px-5 py-3">{deptLabel(u, i18n.language) || '-'}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {!u.is_active ? <Badge tone="red">{t('admin.users.status.inactive')}</Badge>
                              : u.is_locked ? <Badge tone="amber">{t('admin.users.status.locked')}</Badge>
                                : <Badge tone="green">{t('admin.users.status.active')}</Badge>}
                            {u.must_change_password && <Badge tone="blue">{t('admin.users.status.temp')}</Badge>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {u.last_login_at ? formatDateTime(u.last_login_at) : t('admin.users.never')}
                        </td>
                        <td className="px-5 py-3">
                          {u.protected ? (
                            <p className="text-right text-xs text-slate-400" title={t('admin.users.protectedNote')}>
                              <ShieldCheck className="ml-auto h-4 w-4" />
                            </p>
                          ) : (
                            <div className="flex justify-end gap-0.5">
                              {editable && <button title={t('admin.users.act.edit')} className={iconBtn} onClick={() => setForm(u)}><Pencil className="h-4 w-4" /></button>}
                              {editable && u.is_locked && <button title={t('admin.users.act.unlock')} className={iconBtn} onClick={() => unlock(u)}><Unlock className="h-4 w-4" /></button>}
                              {editable && !u.is_self && <button title={t('admin.users.act.reset')} className={iconBtn} onClick={() => setConfirm({ action: 'reset', user: u })}><KeyRound className="h-4 w-4" /></button>}
                              {editable && !u.is_self && (u.is_active
                                ? <button title={t('admin.users.act.deactivate')} className={`${iconBtn} hover:!text-red-600`} onClick={() => setConfirm({ action: 'deactivate', user: u })}><UserX className="h-4 w-4" /></button>
                                : <button title={t('admin.users.act.activate')} className={iconBtn} onClick={() => setConfirm({ action: 'activate', user: u })}><UserCheck className="h-4 w-4" /></button>)}
                              {can('roles.manage') && !u.is_self && <button title={t('admin.users.act.permissions')} className={iconBtn} onClick={() => setPermFor(u)}><ShieldCheck className="h-4 w-4" /></button>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page || page} pages={data.pages} total={data.total} limit={LIMIT} onChange={(p) => { setLoading(true); setPage(p); }} />
          </>
        )}
      </Card>

      {form && (
        <UserFormModal
          user={form === 'new' ? null : form} lookups={lookups} meId={me.id} onClose={() => setForm(null)}
          onSaved={(r) => {
            setForm(null);
            reload();
            if (r?.temporary_password) setTemp({ username: r.username, password: r.temporary_password });
          }}
        />
      )}
      {temp && <TempPasswordModal username={temp.username} password={temp.password} onClose={() => setTemp(null)} />}
      {permFor && <PermissionOverridesModal user={permFor} onClose={() => setPermFor(null)} onSaved={() => { setPermFor(null); reload(); }} />}

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} size="sm"
        title={confirm ? t(`admin.users.confirm.${confirm.action}Title`) : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>{t('form.cancel')}</Button>
            <Button variant={confirm?.action === 'activate' ? 'primary' : 'danger'} onClick={runConfirm} loading={busy}>{t('form.confirm')}</Button>
          </>
        }
      >
        {confirm && <p className="text-sm text-slate-600">{t(`admin.users.confirm.${confirm.action}Msg`, { name: confirm.user.full_name })}</p>}
      </Modal>
    </div>
  );
}