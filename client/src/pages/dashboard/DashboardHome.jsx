import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, AlertTriangle, BedDouble, Boxes, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList,
  Clock, DoorOpen, FlaskConical, HeartPulse, Hourglass, Microscope, Percent, Pill, Receipt, Stethoscope, Timer,
  UserCheck, UserPlus, Users, Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsApi } from '../../api/reports.api';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import StatCard from '../../components/ui/StatCard';
import BarChartCard from '../../components/charts/BarChartCard';
import LineChartCard from '../../components/charts/LineChartCard';
import PieChartCard from '../../components/charts/PieChartCard';
import { NAV_ITEMS } from '../../utils/navigation';
import { formatValue } from '../../utils/reports';
import { formatBirr } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const ICONS = {
  Activity, AlertTriangle, BedDouble, Boxes, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList,
  Clock, DoorOpen, FlaskConical, HeartPulse, Hourglass, Microscope, Percent, Pill, Receipt, Stethoscope, Timer,
  UserCheck, UserPlus, Users, Wallet,
};

export default function DashboardHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { can } = usePermission();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let off = false;
    reportsApi.dashboard()
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) toast.error(errMsg(err, t('login.networkError'))); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [tick, t]);

  const modules = NAV_ITEMS.filter((i) => i.key !== 'dashboard' && can(i.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.welcome', { name: user.full_name })}</h1>
        <p className="text-slate-500">{t('dash.subtitle')}</p>
      </div>

      {loading || !data ? <Spinner /> : (
        <>
          {data.cards.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.cards.map((c) => (
                <StatCard
                  key={c.key} icon={ICONS[c.icon] || Activity} color={c.color}
                  label={t(`dash.card.${c.key}`)} value={formatValue(c.value, c.format, t)}
                />
              ))}
            </div>
          )}

          {data.charts.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {data.charts.map((c) => {
                const title = t(`dash.chart.${c.key}`);
                if (c.type === 'pie') {
                  const slices = c.data.map((d) => ({ name: t(`${c.ns}.${d.key}`), value: d.value }));
                  return <PieChartCard key={c.key} title={title} data={slices} money={c.money} />;
                }
                const Chart = c.type === 'line' ? LineChartCard : BarChartCard;
                return <Chart key={c.key} title={title} data={c.data} money={c.money} />;
              })}
            </div>
          )}

          {data.lists.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {data.lists.map((l) => (
                <Card key={l.key} title={t(`dash.list.${l.key}`)}>
                  {l.rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">{t('dash.listEmpty')}</p>
                  ) : (
                    <ul className="-my-2 divide-y divide-slate-100">
                      {l.rows.map((r) => (
                        <li key={`${l.key}-${r.id}`}>
                          <Link to={r.link} className="flex items-center justify-between gap-3 py-2.5 hover:text-teal-700">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{r.title}</p>
                              <p className="truncate text-xs text-slate-400">{r.subtitle}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {r.amount !== undefined && <span className="text-sm font-semibold text-slate-700">{formatBirr(r.amount)}</span>}
                              <Badge tone={r.tone || 'slate'}>{t(r.badge_key)}</Badge>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Card title={t('dashboard.yourModules')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map(({ key, path, icon: Icon }) => (
            <Link key={key} to={path} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-teal-400 hover:bg-teal-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700"><Icon className="h-[18px] w-[18px]" /></span>
              <span className="text-sm font-medium text-slate-700">{t(`nav.${key}`)}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}