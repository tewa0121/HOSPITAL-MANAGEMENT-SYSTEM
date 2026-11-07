import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, CheckCircle2, Pencil, Percent, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { wardsApi } from '../../api/wards.api';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import { AddBedsModal, BedModal, WardModal } from './WardModals';
import { BED_STYLE, shortName, wardName } from '../../utils/wards';
import { errMsg } from '../../utils/errors';

const STATUSES = ['available', 'occupied', 'cleaning', 'maintenance'];

export default function WardList() {
  const { t, i18n } = useTranslation();
  const { can } = usePermission();
  const manage = can('wards.manage');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [bed, setBed] = useState(null);       // { bed, ward }
  const [wardModal, setWardModal] = useState(null); // 'new' | ward
  const [bedsFor, setBedsFor] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let off = false;
    wardsApi.board()
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [tick, t]);

  const reload = () => setTick((n) => n + 1);
  if (loading || !data) return <Spinner />;
  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.wards')}</h1>
          <p className="text-slate-500">{t('ward.subtitle')}</p>
        </div>
        {manage && (
          <Button onClick={() => setWardModal('new')}><Plus className="h-4 w-4" /> {t('ward.addWard')}</Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BedDouble} color="teal" label={t('ward.sum.beds')} value={s.beds} />
        <StatCard icon={Users} color="amber" label={t('ward.sum.occupied')} value={s.occupied} />
        <StatCard icon={CheckCircle2} color="blue" label={`${t('ward.sum.available')} (${s.cleaning} ${t('ward.sum.cleaning')})`} value={s.available} />
        <StatCard icon={Percent} color="violet" label={`${t('ward.sum.occupancy')} (${s.maintenance} ${t('ward.sum.maintenance')})`} value={`${s.occupancy}%`} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
        {STATUSES.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded border ${BED_STYLE[k]}`} /> {t(`ward.status.${k}`)}
          </span>
        ))}
        <span className="text-xs text-slate-400 sm:ml-auto">{t('ward.legend')} · {t('ward.autoRefresh')}</span>
      </div>

      {data.wards.length === 0 ? (
        <p className="py-16 text-center text-slate-500">{t('ward.empty')}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.wards.map((w) => {
            const used = w.beds.length - w.counts.maintenance;
            const pct = used > 0 ? Math.round((w.counts.occupied / used) * 100) : 0;
            return (
              <Card
                key={w.id}
                className={w.is_active ? '' : 'opacity-70'}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {wardName(w, i18n.language)}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">{w.code}</span>
                    {!w.is_active && <Badge tone="slate">{t('ward.inactive')}</Badge>}
                  </span>
                }
                action={manage && (
                  <div className="flex gap-1">
                    {w.is_active && (
                      <button onClick={() => setBedsFor(w)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        {t('ward.addBeds')}
                      </button>
                    )}
                    <button onClick={() => setWardModal(w)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
              >
                <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                  <span>{t('ward.rate', { rate: w.daily_rate.toLocaleString('en-US', { minimumFractionDigits: 2 }) })}</span>
                  <span>{w.counts.occupied} / {used} · {pct}%</span>
                </div>
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {w.beds.map((b) => (
                    <button
                      key={b.id} onClick={() => setBed({ bed: b, ward: w })}
                      className={`rounded-lg border p-2 text-left text-xs transition hover:shadow ${BED_STYLE[b.status]}`}
                    >
                      <p className="font-semibold">{b.bed_number}</p>
                      <p className="truncate">{b.status === 'occupied' ? shortName(b.patient_name) : t(`ward.status.${b.status}`)}</p>
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {bed && <BedModal bed={bed.bed} ward={bed.ward} onClose={() => setBed(null)} onChanged={() => { setBed(null); reload(); }} />}
      {wardModal && (
        <WardModal
          ward={wardModal === 'new' ? null : wardModal} onClose={() => setWardModal(null)}
          onSaved={() => { setWardModal(null); reload(); }}
        />
      )}
      {bedsFor && <AddBedsModal ward={bedsFor} onClose={() => setBedsFor(null)} onSaved={() => { setBedsFor(null); reload(); }} />}
    </div>
  );
}