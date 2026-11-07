// Adult reference ranges. Children have different limits.
const RANGES = {
  temperature_c: [36, 37.9],
  pulse: [60, 100],
  respiratory_rate: [12, 20],
  bp_systolic: [90, 140],
  bp_diastolic: [60, 90],
  spo2: [94, 100],
};

export function vitalFlag(key, value) {
  if (value === null || value === undefined || value === '' || !RANGES[key]) return null;
  const [lo, hi] = RANGES[key];
  const v = Number(value);
  if (v < lo) return 'low';
  if (v > hi) return 'high';
  return null;
}

export function calcBmi(weight, height) {
  const w = Number(weight);
  const h = Number(height) / 100;
  if (!w || !h) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}