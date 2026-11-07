import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

export default function ComingSoon({ name }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t(`nav.${name}`)}</h1>
      <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <Construction className="h-12 w-12 text-amber-500" />
        <p className="mt-4 text-lg font-semibold text-slate-700">{t('errors.comingSoonTitle')}</p>
        <p className="text-sm text-slate-500">{t('errors.comingSoonMsg')}</p>
      </div>
    </div>
  );
}