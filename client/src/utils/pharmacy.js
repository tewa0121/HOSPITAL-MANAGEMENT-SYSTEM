import { parseDate, todayISO } from './formatters';

export const FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Infusion',
  'Sachet', 'Cream', 'Ointment', 'Drops', 'Inhaler',
];

export const STOCK_TONE = { ok: 'green', low: 'amber', out: 'red' };
export const RX_TONE = { pending: 'amber', partially_dispensed: 'blue', dispensed: 'green', cancelled: 'red' };
export const EXPIRY_SOON_DAYS = 90;

export const medLabel = (m) => [m.generic_name, m.strength].filter(Boolean).join(' ');

export const daysUntil = (iso) =>
  Math.round((parseDate(iso).getTime() - parseDate(todayISO()).getTime()) / 86400000);

// 'expired' | 'soon' | 'ok'
export function expiryState(iso) {
  const days = daysUntil(iso);
  if (days < 0) return { key: 'expired', days, tone: 'red' };
  if (days <= EXPIRY_SOON_DAYS) return { key: 'soon', days, tone: 'amber' };
  return { key: 'ok', days, tone: 'green' };
}

export const num = (n) => Number(n || 0).toLocaleString('en-US');