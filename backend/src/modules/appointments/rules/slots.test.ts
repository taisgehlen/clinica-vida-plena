import { describe, it, expect } from 'vitest';
import { validateSlot, type ScheduleBlock } from './slots.js';

const drPaulo: ScheduleBlock[] = [
  { dia: 'segunda', inicio: '07:00', fim: '12:00' },
  { dia: 'quarta', inicio: '07:00', fim: '12:00' },
  { dia: 'sexta', inicio: '13:00', fim: '18:00' },
];

const draAna: ScheduleBlock[] = [
  { dia: 'terca', inicio: '08:00', fim: '12:00' },
  { dia: 'terca', inicio: '14:00', fim: '18:00' },
];


describe('validateSlot', () => {
  describe('dentro da grade (Dr. Paulo)', () => {
    it('aceita um horário no meio da grade', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T08:30:00')).ok).toBe(true);
    });

    it('aceita o primeiro slot da grade', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T07:00:00')).ok).toBe(true);
    });

    it('aceita o último slot da grade (11:30 termina às 12:00)', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T11:30:00')).ok).toBe(true);
    });

    it('aceita outro dia de atendimento (sexta à tarde)', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-09T15:00:00')).ok).toBe(true);
    });
  });

  describe('fora da grade (Dr. Paulo)', () => {
    it('rejeita horário antes do início da grade', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T06:30:00')).ok).toBe(false);
    });

    it('rejeita 12:00, porque a consulta terminaria 12:30, depois da grade', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T12:00:00')).ok).toBe(false);
    });

    it('rejeita sexta de manhã (ele só atende sexta à tarde)', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-09T09:00:00')).ok).toBe(false);
    });
  });

  describe('dia da semana', () => {
    it('rejeita um dia em que o médico não atende (terça)', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-06T08:00:00')).ok).toBe(false);
    });

    it('rejeita sábado', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-10T08:00:00')).ok).toBe(false);
    });
  });

  describe('alinhamento de 30 minutos', () => {
    it('rejeita horário quebrado (08:15)', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T08:15:00')).ok).toBe(false);
    });

    it('rejeita horário com segundos (08:30:15)', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T08:30:15')).ok).toBe(false);
    });
  });

  describe('mais de um bloco no mesmo dia (Dra. Ana)', () => {
    it('aceita o último slot da manhã', () => {
      expect(validateSlot(draAna, new Date('2026-10-06T11:30:00')).ok).toBe(true);
    });

    it('rejeita horário no intervalo de almoço', () => {
      expect(validateSlot(draAna, new Date('2026-10-06T12:30:00')).ok).toBe(false);
    });

    it('aceita o primeiro slot da tarde', () => {
      expect(validateSlot(draAna, new Date('2026-10-06T14:00:00')).ok).toBe(true);
    });

    it('aceita o último slot da tarde', () => {
      expect(validateSlot(draAna, new Date('2026-10-06T17:30:00')).ok).toBe(true);
    });
  });

  describe('mensagens de erro', () => {
    it('explica o problema de alinhamento', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T08:15:00'))).toEqual({
        ok: false,
        error: 'Consultas devem começar em horários cheios ou meia hora (ex: 08:00, 08:30)',
      });
    });

    it('explica que o médico não atende no dia', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-06T08:00:00'))).toEqual({
        ok: false,
        error: 'O médico não atende neste dia da semana',
      });
    });

    it('explica que o horário está fora da grade', () => {
      expect(validateSlot(drPaulo, new Date('2026-10-05T12:00:00'))).toEqual({
        ok: false,
        error: 'Horário fora da grade de atendimento do médico',
      });
    });
  });
});