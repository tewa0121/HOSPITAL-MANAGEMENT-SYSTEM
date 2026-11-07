import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';

export default function Unauthorized() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <ShieldAlert className="h-16 w-16 text-red-500" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('errors.unauthorizedTitle')}</h1>
      <p className="mt-1 text-slate-500">{t('errors.unauthorizedMsg')}</p>
      <Link to="/dashboard" className="mt-6 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
        {t('common.backHome')}
      </Link>
    </div>
  );
}