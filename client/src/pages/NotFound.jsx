import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      <p className="text-7xl font-bold text-teal-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('errors.notFoundTitle')}</h1>
      <p className="mt-1 text-slate-500">{t('errors.notFoundMsg')}</p>
      <Link to="/dashboard" className="mt-6 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
        {t('common.backHome')}
      </Link>
    </div>
  );
}