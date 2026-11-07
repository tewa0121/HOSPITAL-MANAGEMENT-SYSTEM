export const BED_STYLE = {
  available: 'border-green-300 bg-green-50 text-green-800',
  occupied: 'border-red-300 bg-red-50 text-red-800',
  reserved: 'border-blue-300 bg-blue-50 text-blue-800',
  cleaning: 'border-amber-300 bg-amber-50 text-amber-800',
  maintenance: 'border-slate-300 bg-slate-100 text-slate-500',
};
export const BED_TONE = { available: 'green', occupied: 'red', reserved: 'blue', cleaning: 'amber', maintenance: 'slate' };
export const ADM_TONE = { admitted: 'teal', discharged: 'slate', transferred: 'blue' };

// works for objects with name / name_am or ward_name / ward_name_am
export const wardName = (w, lang) => {
  const am = w.name_am || w.ward_name_am;
  return lang === 'am' && am ? am : (w.name || w.ward_name);
};

export const shortName = (p) => String(p || '').split(' ').slice(0, 2).join(' ');

export const stayText = (minutes) => {
  const m = Number(minutes || 0);
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
};