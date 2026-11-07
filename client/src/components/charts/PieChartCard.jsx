import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import Card from '../ui/Card';
import { formatBirr } from '../../utils/formatters';

const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#64748b'];

// data: [{ name, value }]
export default function PieChartCard({ title, data, money = false, height = 240 }) {
  const { t } = useTranslation();
  const shown = data.filter((d) => d.value > 0);
  return (
    <Card title={title}>
      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">{t('dash.noData')}</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={shown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={2}>
                {shown.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => (money ? formatBirr(v) : v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}