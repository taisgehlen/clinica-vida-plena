import { describe, expect, it } from 'vitest';
import { googleCalendarUrl, icsContent } from './calendar';

const event = {
  title: 'Consulta – Dr. Paulo Mendes',
  details: 'Cardiologia na Clínica Vida Plena',
  location: 'Clínica Vida Plena',
  start: new Date('2026-10-06T14:00:00-03:00'),
  minutes: 30,
};

describe('agenda', () => {
  it('monta o link do Google Agenda em UTC, com início e fim', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261006T170000Z/20261006T173000Z');
    expect(url.searchParams.get('text')).toBe('Consulta – Dr. Paulo Mendes');
  });

  it('gera o arquivo .ics com os dois lembretes', () => {
    const ics = icsContent(event, 'abc', new Date('2026-10-04T12:00:00Z'));
    expect(ics).toContain('DTSTART:20261006T170000Z');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
