import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, HeartPulse, UserRound } from 'lucide-react';
import LanguageSwitch from '../../components/ui/LanguageSwitch';
import { CONTACT, NAME, langOf } from '../../utils/hospital';

const TXT = {
  en: { home: 'Home', staff: 'Staff Login', dashboard: 'Open dashboard', news: 'News & Events', portal: 'Patient Portal', rights: 'All Rights Reserved' },
  am: { home: 'መነሻ', staff: 'የሠራተኛ መግቢያ', dashboard: 'ዳሽቦርድ ክፈት', news: 'ዜና', portal: 'የታካሚ ፖርታል', rights: 'መብቱ በሕግ የተጠበቀ ነው' },
};

// Shared frame for the public pages (news, patient portal)
export default function PublicLayout({ children }) {
  const { i18n } = useTranslation();
  const lang = langOf(i18n);
  const L = TXT[lang];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-700">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600"><HeartPulse className="h-6 w-6 text-white" /></span>
            <span className="text-sm font-extrabold tracking-wide text-sky-950 sm:text-base">{NAME[lang]}</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium sm:flex">
            <Link to="/news" className="hover:text-teal-700">{L.news}</Link>
            <Link to="/portal" className="hover:text-teal-700">{L.portal}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <Link to="/login" className="hidden items-center gap-2 rounded-lg bg-sky-950 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900 sm:inline-flex">
              <UserRound className="h-4 w-4" /> {L.staff}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <Link to="/" className="mb-5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700">
          <ArrowLeft className="h-4 w-4" /> {L.home}
        </Link>
        {children}
      </main>

      <footer className="bg-slate-950 py-6 text-center text-xs text-slate-400">
        <p className="font-semibold text-white">{NAME[lang]}</p>
        <p className="mt-1">{CONTACT.address} · {CONTACT.phone} · {CONTACT.email}</p>
        <p className="mt-2 text-slate-500">© {new Date().getFullYear()} {L.rights}</p>
      </footer>
    </div>
  );
}
