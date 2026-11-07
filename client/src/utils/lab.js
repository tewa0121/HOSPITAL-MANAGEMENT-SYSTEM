// A test is numeric when it has a reference limit; otherwise it is qualitative (Negative / Positive)
export const isNumericTest = (o) =>
  (o.ref_low !== null && o.ref_low !== undefined) || (o.ref_high !== null && o.ref_high !== undefined);

// Same rule as the server, used only to preview the flag while typing
export function previewFlag(order, raw) {
  const text = String(raw || '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  const lo = order.ref_low === null || order.ref_low === undefined ? null : Number(order.ref_low);
  const hi = order.ref_high === null || order.ref_high === undefined ? null : Number(order.ref_high);
  let flag = 'normal';
  if (lo !== null && n < lo) flag = 'low';
  if (hi !== null && n > hi) flag = 'high';
  if ((lo !== null && lo > 0 && n < lo * 0.5) || (hi !== null && hi > 0 && n > hi * 2)) flag = 'critical';
  return flag;
}

export const minutesSince = (s) =>
  Math.max(0, Math.round((Date.now() - new Date(String(s).replace(' ', 'T')).getTime()) / 60000));

export const formatDuration = (min) =>
  (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} m`);

export const QUALITATIVE_VALUES = ['Negative', 'Positive', 'Non-reactive', 'Reactive', 'Normal', 'No parasites seen'];
export const REJECT_REASONS = [
  'Hemolyzed sample', 'Insufficient volume', 'Clotted sample', 'Wrong container', 'Unlabeled sample',
];