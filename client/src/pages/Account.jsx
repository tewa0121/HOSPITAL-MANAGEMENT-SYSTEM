import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api/auth.api';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { errMsg } from '../utils/errors';

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || '-'}</p>
    </div>
  );
}

export default function Account() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!form.current) er.current = t('form.required');
    if (form.next.length < 8) er.next = t('account.tooShort');
    else if (!/[A-Z]/.test(form.next)) er.next = t('account.needUpper');
    else if (!/[0-9]/.test(form.next)) er.next = t('account.needDigit');
    else if (form.next === form.current) er.next = t('account.same');
    if (form.confirm !== form.next) er.confirm = t('account.mismatch');
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const res = await authApi.changePassword(form.current, form.next);
      await refresh(res.data.data.token); // the old token no longer works
      toast.success(t('account.saved'));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errMsg(err, t('login.networkError')));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('account.title')}</h1>
        <p className="text-slate-500">{t('account.subtitle')}</p>
      </div>

      {user.must_change_password && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{t('account.mustChange')}</p>
        </div>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Info label={t('account.info.name')} value={user.full_name} />
          <Info label={t('account.info.username')} value={user.username} />
          <Info label={t('account.info.role')} value={user.role_display} />
          <Info label={t('account.info.department')} value={user.department} />
        </div>
      </Card>

      <Card title={t('account.change')}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <Input label={t('account.current')} type="password" required autoComplete="current-password"
            value={form.current} onChange={set('current')} error={errors.current} />
          <Input label={t('account.new')} type="password" required autoComplete="new-password"
            value={form.next} onChange={set('next')} error={errors.next} hint={t('account.rules')} />
          <Input label={t('account.confirm')} type="password" required autoComplete="new-password"
            value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>{t('account.submit')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}