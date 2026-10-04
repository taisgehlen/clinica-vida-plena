import type { Period } from '../api/indicators';

const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function presetPeriod(months: number | null, today = new Date()): Period {
  if (months === null) return { from: '', to: '' };
  const from = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
  return { from: toInputDate(from), to: toInputDate(today) };
}