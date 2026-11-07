import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsApi } from '../../api/reports.api';
import { usePermission } from '../../hooks/usePermission';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import BarChartCard from '../../components/charts/BarChartCard';
import LineChartCard from '../../components/charts/LineChartCard';
import { downloadCsv } from '../../utils/csv';
import { csvValue, formatValue } from '../../utils/reports';
import { addDays, formatDate, formatDateTime, todayISO } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

const SECTIONS = [
  { key: 'overview', perms: ['reports.hospital'] },
  { key: 'clinical', perms: ['reports.hospital'] },
  { key: 'lab', perms: ['reports.hospital'] },
  { key: 'inpatient', perms: ['reports.hospital'] },
  { key: 'finance', perms: ['billing.invoice_read'] },
  { key: 'pharmacy', perms: ['pharmacy.stock_read'] },
];
const PRESETS = ['today', 'last7', 'last30', 'thisMonth'];

function presetRange(k) {
  const t = todayISO();
  if (k === 'today') return [t, t];
  if (k === 'last7') return [addDays(t, -6), t];
  if (k === 'thisMonth') return [`${t.slice(0, 8)}01`, t];
  return [addDays(t, -29), t];
}

export default function Reports() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const visible = SECTIONS.filter((s) => s.perms.every((p) => can(p)));

  const [section, setSection] = useState(visible[0]?.key);
  const [preset, setPreset] = useState('last30');
  const [[from, to], setRange] = useState(presetRange('last30'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const rangeError = from > to;

  useEffect(() => {
    if (!section || rangeError) return undefined;
    let off = false;
    setLoading(true);
    reportsApi.section(section, { from, to })
      .then((res) => { if (!off) setData(res.data.data); })
      .catch((err) => { if (!off) { setData(null); toast.error(errMsg(err, t('login.networkError'))); } })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [section, from, to, rangeError, t]);

  const pickPreset = (k) => { setPreset(k); setRange(presetRange(k)); };
  const pickDate = (which, value) => {
    if (!value) return;
    setPreset('custom');
    setRange(which === 'from' ? [value, to] : [from, value]);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await reportsApi.exportLog({ section, from, to });
      const rows = [
        [t('app.hospital')],
        [t(`rep.tab.${section}`), `${t('rep.from')} ${from}`, `${t('rep.to')} ${to}`],
        [],
      ];
      data.kpis.forEach((k) => rows.push([t(`rep.kpi.${k.key}`), csvValue(k.value, k.format, t)]));
      data.tables.forEach((tb) => {
        rows.push([], [t(`rep.table.${tb.key}`)], tb.columns.map((c) => t(`rep.col.${c.key}`)));
        tb.rows.forEach((r) => rows.push(tb.columns.map((c) => csvValue(r[c.key], c.format, t))));
      });
      data.charts.forEach((ch) => {
        rows.push([], [t(`rep.chart.${ch.key}`)], [t('rep.col.date'), t('rep.col.value')]);
        ch.data.forEach((d) => rows.push([d.date, d.value]));
      });
      downloadCsv(`hms-${section}-${from}_${to}.csv`, rows);
      toast.success(t('rep.exported'));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setExporting(false);
    }
  };

  if (visible.length === 0) return <p className="py-16 text-center text-slate-500">{t('rep.noAccess')}</p>;

  const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">{t('nav.reports')}</h1>
        <p className="text-slate-500">{t('rep.subtitle')}</p>
      </div>

      <div className="hidden text-center print:block">
        <p className="text-xl font-bold">{t('app.hospital')}</p>
        <p className="text-sm">{t(`rep.tab.${section}`)} · {t('rep.period')}: {formatDate(from)} - {formatDate(to)}</p>
        <p className="text-xs text-slate-500">{t('rep.generated')}: {formatDateTime(new Date().toISOString().slice(0, 19).replace('T', ' '))}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
        {visible.map((s) => (
          <button
            key={s.key} onClick={() => setSection(s.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              section === s.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`rep.tab.${s.key}`)}
          </button>
        ))}
      </div>

      <Card className="print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((k) => (
              <button
                key={k} onClick={() => pickPreset(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  preset === k ? 'bg-teal-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t(`rep.preset.${k}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {t('rep.from')} <input type="date" className={inputCls} value={from} max={to} onChange={(e) => pickDate('from', e.target.value)} />
            {t('rep.to')} <input type="date" className={inputCls} value={to} max={todayISO()} onChange={(e) => pickDate('to', e.target.value)} />
          </div>
          <div className="flex gap-2 lg:ml-auto">
            {can('reports.export') && (
              <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!data || loading}>
                <Download className="h-4 w-4" /> {t('rep.export')}
              </Button>
            )}
            <Button variant="ghost" onClick={() => window.print()} disabled={!data || loading}>
              <Printer className="h-4 w-4" /> {t('rep.print')}
            </Button>
          </div>
        </div>
        {rangeError && <p className="mt-3 text-sm text-red-600">{t('rep.rangeError')}</p>}
      </Card>

      {loading || !data ? <Spinner /> : (
        <>
          {data.scope === 'mine' && (
            <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{t('rep.mineNote')}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.kpis.map((k) => (
              <div key={k.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{t(`rep.kpi.${k.key}`)}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatValue(k.value, k.format, t)}</p>
                <p className="mt-1 text-xs text-slate-400">{t(`rep.def.${k.key}`)}</p>
              </div>
            ))}
          </div>

          {data.charts.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {data.charts.map((c) => {
                const Chart = c.type === 'line' ? LineChartCard : BarChartCard;
                return <Chart key={c.key} title={t(`rep.chart.${c.key}`)} data={c.data} money={c.money} />;
              })}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {data.tables.map((tb) => (
              <Card key={tb.key} className="overflow-hidden" title={t(`rep.table.${tb.key}`)}>
                {tb.rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">{t('rep.noData')}</p>
                ) : (
                  <div className="-mx-5 -mb-5 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          {tb.columns.map((c, i) => (
                            <th key={c.key} className={`px-5 py-3 ${i > 0 && c.format !== 'text' ? 'text-right' : ''}`}>{t(`rep.col.${c.key}`)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tb.rows.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {tb.columns.map((c, i) => (
                              <td key={c.key} className={`px-5 py-2.5 ${i > 0 && c.format !== 'text' ? 'whitespace-nowrap text-right' : ''} ${i === 0 ? 'font-medium text-slate-800' : ''}`}>
                                {formatValue(r[c.key], c.format, t)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}