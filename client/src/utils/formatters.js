import { formatEthiopian } from './ethiopianDate';

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());

export const parseDate = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso, n) => {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const formatDate = (s) =>
  s ? parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const formatDateEt = (s, lang = 'en') => (s ? formatEthiopian(parseDate(s), lang) : '');
export const formatTime = (t) => (t ? String(t).slice(0, 5) : '-');
export const formatDateTime = (s) => (s ? `${formatDate(s)} ${String(s).slice(11, 16)}` : '-');

export const fullName = (p) => [p.first_name, p.father_name, p.grandfather_name].filter(Boolean).join(' ');

export const calcAge = (dob) => {
  if (!dob) return '-';
  const b = parseDate(dob);
  const n = new Date();
  let years = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) years--;
  if (years >= 1) return `${years} y`;
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months--;
  return `${Math.max(months, 0)} mo`;
};

export const formatBirr = (n) =>
  `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;