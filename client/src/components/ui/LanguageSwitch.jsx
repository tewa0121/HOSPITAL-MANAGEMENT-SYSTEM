import { useTranslation } from 'react-i18next';

export default function LanguageSwitch() {
  const { i18n } = useTranslation();

  const change = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('lang', lng);
    document.documentElement.lang = lng;
  };

  const btn = (lng, label) => (
    <button
      onClick={() => change(lng)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        i18n.language === lng ? 'bg-teal-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
      {btn('en', 'EN')}
      {btn('am', 'አማ')}
    </div>
  );
}