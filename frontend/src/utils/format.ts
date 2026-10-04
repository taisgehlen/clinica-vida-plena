const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentRounded = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('pt-BR');
const oneDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const formatPercent = (value: number | null) => (value === null ? '—' : percent.format(value));

export const formatPercentRounded = (value: number | null) => (value === null ? '—' : percentRounded.format(value));

export const formatNumber = (value: number) => integer.format(value);

export const formatDecimal = (value: number) => oneDecimal.format(value);

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTHS[Number(m) - 1]}/${year!.slice(2)}`;
}

export function formatMonthShort(month: string): string {
  return MONTHS[Number(month.split('-')[1]) - 1] ?? month;
}

export function formatDate(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}