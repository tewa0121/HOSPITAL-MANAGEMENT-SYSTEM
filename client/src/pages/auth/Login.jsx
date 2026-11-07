import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, HeartPulse, Loader2, Lock, ShieldCheck, User, Languages, ScrollText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LanguageSwitch from '../../components/ui/LanguageSwitch';

const DEMO = [
  ['superadmin', 'Super Admin'], ['admin', 'Admin'], ['doctor1', 'Doctor'], ['nurse1', 'Nurse'],
  ['reception1', 'Reception'], ['lab1', 'Lab'], ['pharma1', 'Pharmacist'], ['cashier1', 'Cashier'],
];

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError(t('login.required'));
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t('login.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const features = [
    [ShieldCheck, t('login.f1')],
    [ScrollText, t('login.f2')],
    [Languages, t('login.f3')],
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <HeartPulse className="h-7 w-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">HMS</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight text-white">{t('app.hospital')}</h1>
          <p className="mt-3 text-lg text-teal-100">{t('app.tagline')}</p>
          <ul className="mt-10 space-y-4">
            {features.map(([Icon, text]) => (
              <li key={text} className="flex items-start gap-3 text-teal-50">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="pt-1 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-teal-200/70">© {new Date().getFullYear()} {t('app.hospital')}</p>
      </div>

      {/* Right: form */}
      <div className="flex w-full flex-col justify-center bg-slate-50 px-6 py-10 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:invisible">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
                <HeartPulse className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">HMS</span>
            </div>
            <LanguageSwitch />
          </div>

          <h2 className="text-3xl font-bold text-slate-900">{t('login.welcome')}</h2>
          <p className="mt-2 text-slate-500">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('login.username')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.usernamePh')}
                  autoComplete="username"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('login.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPh')}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          {/* Demo accounts: remove for production */}
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <p className="mb-3 text-xs font-medium text-slate-500">{t('login.demoTitle')}</p>
            <div className="flex flex-wrap gap-2">
              {DEMO.map(([u, label]) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => { setUsername(u); setPassword('Hms@2026'); setError(''); }}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-teal-100 hover:text-teal-800"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}