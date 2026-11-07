import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import Card from '../ui/Card';
import { formatBirr, formatDate, parseDate } from '../../utils/formatters';

const tick = (s) => parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function BarChartCard({ title, data, money = false, height = 240 }) {
  const { t } = useTranslation();
  const empty = !data.some((d) => d.value !== 0);
  return (
    <Card title={title}>
      {empty ? (
        <p className="py-16 text-center text-sm text-slate-400">{t('dash.noData')}</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis allowDecimals={money} tick={{ fontSize: 12 }} width={money ? 60 : 36} />
              <Tooltip labelFormatter={formatDate} formatter={(v) => [money ? formatBirr(v) : v, '']} />
              <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}