import { formatBirr } from './formatters';

const NUMERIC = ['money', 'percent', 'minutes', 'days', 'number'];

export function formatValue(v, format, t) {
  if (v === null || v === undefined || v === '') return '-';
  switch (format) {
    case 'money': return formatBirr(v);
    case 'percent': return `${v}%`;
    case 'minutes': return `${v} ${t('rep.min')}`;
    case 'days': return `${v}`;
    case 'number': return Number(v).toLocaleString('en-US');
    case 'method': return t(`bill.method.${v}`);
    case 'category': return t(`bill.d.type.${v}`);
    case 'age': return t(`rep.age.${v}`);
    default: return String(v);
  }
}

// numbers stay numbers in the CSV so Excel can calculate with them
export const csvValue = (v, format, t) => {
  if (v === null || v === undefined) return '';
  return NUMERIC.includes(format) ? v : formatValue(v, format, t);
};