import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, total, limit, onChange }) {
  const { t } = useTranslation();
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const btn = 'inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row">
      <p className="text-sm text-slate-500">{t('form.showing', { from, to, total })}</p>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> {t('form.previous')}
        </button>
        <span className="px-2 text-sm text-slate-600">{page} / {pages}</span>
        <button className={btn} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          {t('form.next')} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}