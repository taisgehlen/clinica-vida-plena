import { describe, expect, it } from 'vitest';
import { confirmationStatus, offerStatus, SKIP_LABELS, TIMELINE_LABELS } from './rescheduling';
import { daysLabel, formatDayTime, formatRemaining } from './datetime';

describe('textos de confirmações e vagas', () => {
  it('mostra o 2º lembrete quando ainda aguarda resposta', () => {
    expect(confirmationStatus('pendente', false).label).toBe('Aguardando resposta');
    expect(confirmationStatus('pendente', true).label).toBe('Aguardando · 2º lembrete');
    expect(confirmationStatus('sem_resposta', true)).toEqual({ label: 'Sem resposta · ligar', tone: 'alert' });
  });

  it('traduz situações do convite, motivos da fila e eventos', () => {
    expect(offerStatus('aceita').label).toBe('Antecipou');
    expect(SKIP_LABELS.no_phone).toBe('sem telefone para contato');
    expect(TIMELINE_LABELS.no_answer).toBe('Não respondeu às 2 mensagens');
  });
});

describe('datas', () => {
  it('formata dia e hora como no protótipo', () => {
    expect(formatDayTime('2026-10-06T14:00:00-03:00')).toBe('ter, 06/10 às 14:00');
  });

  it('mostra o tempo restante da oferta', () => {
    const now = new Date('2026-10-06T12:00:00-03:00').getTime();
    expect(formatRemaining('2026-10-06T13:20:00-03:00', now)).toBe('1h20');
    expect(formatRemaining('2026-10-06T12:02:05-03:00', now)).toBe('2min 05s');
    expect(formatRemaining('2026-10-06T11:00:00-03:00', now)).toBe('0min 00s');
  });

  it('usa singular para 1 dia', () => {
    expect(daysLabel(1)).toBe('1 dia');
    expect(daysLabel(44)).toBe('44 dias');
  });
});
