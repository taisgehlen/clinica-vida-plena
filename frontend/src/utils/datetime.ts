const dayTime = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const weekdayDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export function formatDayTime(iso: string): string {
  const parts = Object.fromEntries(dayTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.weekday?.replace('.', '')}, ${parts.day}/${parts.month} às ${parts.hour}:${parts.minute}`;
}

export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

export function formatEventMoment(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? time.format(date) : `${weekdayDay.format(date).replace('.', '')} ${time.format(date)}`;
}

export function formatRemaining(untilIso: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((new Date(untilIso).getTime() - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}`;
  return `${minutes}min ${String(seconds % 60).padStart(2, '0')}s`;
}

export function daysLabel(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}

const weekdayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });

export function formatHour(iso: string): string {
  const date = new Date(iso);
  const minutes = date.getMinutes();
  return minutes === 0 ? `${date.getHours()}h` : `${date.getHours()}h${String(minutes).padStart(2, '0')}`;
}

export function formatLong(iso: string): string {
  return `${weekdayLong.format(new Date(iso))}, ${formatShortDate(iso)}, às ${formatHour(iso)}`;
}
