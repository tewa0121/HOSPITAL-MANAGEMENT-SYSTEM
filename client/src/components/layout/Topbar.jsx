import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, KeyRound, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LanguageSwitch from '../ui/LanguageSwitch';
import { formatEthiopian } from '../../utils/ethiopianDate';

export default function Topbar({ onMenu }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const now = new Date();
  const gregorian = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const initials = (user?.full_name || '').replace(/^Dr\.\s*/i, '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null; // ዩዘሩ እስኪጫን ድረስ ባዶ እንዳይበላሽ መከላከል

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur print:hidden sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold text-slate-800">{formatEthiopian(now, i18n.language)}</p>
          <p className="text-xs text-slate-500">{gregorian}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSwitch />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left leading-tight md:block">
              <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
              <p className="text-xs text-slate-500">{user.role_display}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
                  <p className="text-xs text-slate-500">@{user.username}</p>
                  {user.department && <p className="text-xs text-slate-500">{user.department}</p>}
                </div>
                <Link
                  to="/account" onClick={() => setMenuOpen(false)}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {t('account.title')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  {t('common.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}