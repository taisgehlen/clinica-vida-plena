export type CalendarEvent = { title: string; details: string; location: string; start: Date; minutes: number };

const toUtcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const escapeIcs = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function googleCalendarUrl(event: CalendarEvent): string {
  const end = new Date(event.start.getTime() + event.minutes * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toUtcStamp(event.start)}/${toUtcStamp(end)}`,
    details: event.details,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsContent(event: CalendarEvent, uid: string, now: Date = new Date()): string {
  const end = new Date(event.start.getTime() + event.minutes * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clinica Vida Plena//PT',
    'BEGIN:VEVENT',
    `UID:${uid}@vidaplena`,
    `DTSTAMP:${toUtcStamp(now)}`,
    `DTSTART:${toUtcStamp(event.start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.details)}`,
    `LOCATION:${escapeIcs(event.location)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Consulta amanhã',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Consulta em 2 horas',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(event: CalendarEvent, uid: string): void {
  const url = URL.createObjectURL(new Blob([icsContent(event, uid)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'consulta.ics';
  link.click();
  URL.revokeObjectURL(url);
}
