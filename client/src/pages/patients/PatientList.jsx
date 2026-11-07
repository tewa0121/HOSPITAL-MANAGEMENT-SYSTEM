import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { patientsApi } from '../../api/patients.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Pagination from '../../components/ui/Pagination';
import Spinner from '../../components/ui/Spinner';
import { calcAge, formatDate, fullName } from '../../utils/formatters';

const LIMIT = 10;

export default function PatientList() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  // wait until the user stops typing before searching
  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let off = false;
    setLoading(true);
    patientsApi.list({ search: query, page, limit: LIMIT })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => toast.error(err.response?.data?.message || t('login.networkError')))
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [query, page, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('patients.title')}</h1>
          <p className="text-slate-500">{t('patients.subtitle')}</p>
        </div>
        {can('patients.create') && (
          <Button onClick={() => navigate('/patients/new')}>
            <Plus className="h-4 w-4" /> {t('patients.register')}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('patients.searchPh')}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{t('form.noRecords')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t('patients.mrn')}</th>
                  <th className="px-5 py-3">{t('patients.fullName')}</th>
                  <th className="px-5 py-3">{t('patients.age')}</th>
                  <th className="px-5 py-3">{t('patients.gender')}</th>
                  <th className="px-5 py-3">{t('patients.phone')}</th>
                  <th className="px-5 py-3">{t('patients.registered')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/patients/${p.id}`)}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-600">{p.mrn}</td>
                    <td className="px-5 py-3">
                      <Link to={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-800 hover:text-teal-700">
                        {fullName(p)}
                      </Link>
                      {p.status !== 'active' && (
                        <span className="ml-2"><Badge tone="red">{t(`patients.statusValues.${p.status}`)}</Badge></span>
                      )}
                    </td>
                    <td className="px-5 py-3">{calcAge(p.date_of_birth)}</td>
                    <td className="px-5 py-3">{t(`patients.${p.gender}`)}</td>
                    <td className="whitespace-nowrap px-5 py-3">{p.phone || '-'}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {can('patients.update') && (
                        <button
                          title={t('form.edit')}
                          onClick={(e) => { e.stopPropagation(); navigate(`/patients/${p.id}/edit`); }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pages={data.pages} total={data.total} limit={LIMIT} onChange={setPage} />
      </Card>
    </div>
  );
}