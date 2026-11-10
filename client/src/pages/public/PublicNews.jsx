import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Megaphone, Newspaper } from 'lucide-react';
import PublicLayout from './PublicLayout';
import { langOf } from '../../utils/hospital';

const TXT = {
  en: { title: 'News & Events', sub: 'Announcements and updates from the hospital', empty: 'No news yet.', error: 'Could not load the news. Please try again.', all: 'All news', read: 'Read more', kind: { news: 'News', event: 'Event', announcement: 'Announcement' }, on: 'Event date' },
  am: { title: 'ዜና እና ክስተቶች', sub: 'ከሆስፒታሉ የሚወጡ ማስታወቂያዎችና ዜናዎች', empty: 'እስካሁን ዜና የለም።', error: 'ዜናውን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።', all: 'ሁሉም ዜናዎች', read: 'ተጨማሪ ያንብቡ', kind: { news: 'ዜና', event: 'ክስተት', announcement: 'ማስታወቂያ' }, on: 'የክስተቱ ቀን' },
};
const ICON = { news: Newspaper, event: CalendarDays, announcement: Megaphone };
const day = (v) => String(v || '').slice(0, 10);

export default function PublicNews() {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const lang = langOf(i18n);
  const L = TXT[lang];
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let off = false;
    setData(null); setError(false);
    fetch(id ? `/api/public/news/${id}` : '/api/public/news')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (!off) setData(j.data); })
      .catch(() => { if (!off) setError(true); });
    return () => { off = true; };
  }, [id]);

  const pick = (o, f) => (lang === 'am' && o[`${f}_am`]) || o[`${f}_en`];

  return (
    <PublicLayout>
      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{L.error}</p>}
      {!error && (!data || (id ? Array.isArray(data) : !Array.isArray(data))) && <p className="py-16 text-center text-slate-500">…</p>}

      {/* single post */}
      {id && data && !Array.isArray(data) && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{L.kind[data.kind]}</span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{pick(data, 'title')}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {day(data.published_at)}{data.event_date ? ` · ${L.on}: ${day(data.event_date)}` : ''}
          </p>
          <p className="mt-6 whitespace-pre-line leading-relaxed">{pick(data, 'body')}</p>
          <Link to="/news" className="mt-8 inline-block text-sm font-semibold text-teal-700 hover:underline">← {L.all}</Link>
        </article>
      )}

      {/* list */}
      {!id && Array.isArray(data) && (
        <>
          <h1 className="text-3xl font-bold text-slate-900">{L.title}</h1>
          <p className="mt-1 text-slate-500">{L.sub}</p>
          {data.length === 0 ? (
            <p className="mt-10 text-center text-slate-500">{L.empty}</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {data.map((p) => {
                const Icon = ICON[p.kind] || Newspaper;
                return (
                  <Link key={p.id} to={`/news/${p.id}`} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
                      <Icon className="h-4 w-4" /> {L.kind[p.kind]}
                      <span className="font-normal text-slate-400">· {day(p.published_at)}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-slate-900 group-hover:text-teal-700">{pick(p, 'title')}</h2>
                    <p className="mt-1 text-sm text-slate-600">{pick(p, 'excerpt')}</p>
                    <p className="mt-3 text-sm font-semibold text-teal-700">{L.read} →</p>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </PublicLayout>
  );
}