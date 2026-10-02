import { describe, it, expect } from 'vitest';
import { validateTransition } from './status.js';

const appointment = new Date('2026-10-07T10:00:00');
const before = new Date('2026-10-07T09:00:00');   
const exactTime = new Date('2026-10-07T10:00:00');
const after = new Date('2026-10-07T11:00:00');   

describe('validateTransition', () => {
  describe('a partir de "agendada"', () => {
    it('permite confirmar antes do horário', () => {
      expect(validateTransition('agendada', 'confirmada', appointment, before).ok).toBe(true);
    });

    it('rejeita confirmar depois que a consulta começou', () => {
      expect(validateTransition('agendada', 'confirmada', appointment, after).ok).toBe(false);
    });

    it('rejeita registrar falta antes do horário', () => {
      expect(validateTransition('agendada', 'falta', appointment, before).ok).toBe(false);
    });

    it('permite registrar falta depois do horário', () => {
      expect(validateTransition('agendada', 'falta', appointment, after).ok).toBe(true);
    });

    it('rejeita registrar realizada antes do horário', () => {
      expect(validateTransition('agendada', 'realizada', appointment, before).ok).toBe(false);
    });

    it('permite registrar realizada depois do horário', () => {
      expect(validateTransition('agendada', 'realizada', appointment, after).ok).toBe(true);
    });

    it('permite cancelamento pelo paciente antes do horário', () => {
      expect(validateTransition('agendada', 'cancelada_paciente', appointment, before).ok).toBe(true);
    });

    it('rejeita cancelamento pelo paciente depois do horário', () => {
      expect(validateTransition('agendada', 'cancelada_paciente', appointment, after).ok).toBe(false);
    });

    it('permite cancelamento pela clínica antes do horário', () => {
      expect(validateTransition('agendada', 'cancelada_clinica', appointment, before).ok).toBe(true);
    });

    it('rejeita cancelamento pela clínica depois do horário', () => {
      expect(validateTransition('agendada', 'cancelada_clinica', appointment, after).ok).toBe(false);
    });

    it('rejeita mudar para o mesmo status', () => {
      expect(validateTransition('agendada', 'agendada', appointment, before).ok).toBe(false);
    });
  });

  describe('a partir de "confirmada"', () => {
    it('rejeita voltar para agendada', () => {
      expect(validateTransition('confirmada', 'agendada', appointment, before).ok).toBe(false);
    });

    it('rejeita mudar para o mesmo status', () => {
      expect(validateTransition('confirmada', 'confirmada', appointment, before).ok).toBe(false);
    });

    it('rejeita registrar falta antes do horário', () => {
      expect(validateTransition('confirmada', 'falta', appointment, before).ok).toBe(false);
    });

    it('permite registrar falta depois do horário', () => {
      expect(validateTransition('confirmada', 'falta', appointment, after).ok).toBe(true);
    });

    it('rejeita registrar realizada antes do horário', () => {
      expect(validateTransition('confirmada', 'realizada', appointment, before).ok).toBe(false);
    });

    it('permite registrar realizada depois do horário', () => {
      expect(validateTransition('confirmada', 'realizada', appointment, after).ok).toBe(true);
    });

    it('permite cancelamento pelo paciente antes do horário', () => {
      expect(validateTransition('confirmada', 'cancelada_paciente', appointment, before).ok).toBe(true);
    });

    it('rejeita cancelamento pelo paciente depois do horário', () => {
      expect(validateTransition('confirmada', 'cancelada_paciente', appointment, after).ok).toBe(false);
    });

    it('permite cancelamento pela clínica antes do horário', () => {
      expect(validateTransition('confirmada', 'cancelada_clinica', appointment, before).ok).toBe(true);
    });

    it('rejeita cancelamento pela clínica depois do horário', () => {
      expect(validateTransition('confirmada', 'cancelada_clinica', appointment, after).ok).toBe(false);
    });
  });

  describe('exatamente no horário da consulta (10:00 em ponto)', () => {
    it('considera que a consulta já começou: rejeita cancelar', () => {
      expect(validateTransition('agendada', 'cancelada_paciente', appointment, exactTime).ok).toBe(false);
    });

    it('considera que a consulta já começou: rejeita confirmar', () => {
      expect(validateTransition('agendada', 'confirmada', appointment, exactTime).ok).toBe(false);
    });

    it('considera que a consulta já começou: permite registrar falta', () => {
      expect(validateTransition('agendada', 'falta', appointment, exactTime).ok).toBe(true);
    });

    it('considera que a consulta já começou: permite registrar realizada', () => {
      expect(validateTransition('confirmada', 'realizada', appointment, exactTime).ok).toBe(true);
    });
  });

  describe('status finais não mudam mais', () => {
    it('rejeita mudar de realizada para falta', () => {
      expect(validateTransition('realizada', 'falta', appointment, after).ok).toBe(false);
    });

    it('rejeita mudar de falta para realizada', () => {
      expect(validateTransition('falta', 'realizada', appointment, after).ok).toBe(false);
    });

    it('rejeita reabrir uma consulta cancelada pelo paciente', () => {
      expect(validateTransition('cancelada_paciente', 'agendada', appointment, before).ok).toBe(false);
    });

    it('rejeita reabrir uma consulta cancelada pela clínica', () => {
      expect(validateTransition('cancelada_clinica', 'confirmada', appointment, before).ok).toBe(false);
    });
  });

  describe('mensagens de erro', () => {
    it('explica que status final não pode ser alterado', () => {
      expect(validateTransition('realizada', 'falta', appointment, after)).toEqual({
        ok: false,
        error: 'Status final não pode ser alterado',
      });
    });

    it('explica que falta só pode ser registrada a partir do horário', () => {
      expect(validateTransition('agendada', 'falta', appointment, before)).toEqual({
        ok: false,
        error: 'Realizada e falta só podem ser registradas a partir do horário da consulta',
      });
    });

    it('explica que cancelamento só é permitido antes do horário', () => {
      expect(validateTransition('agendada', 'cancelada_paciente', appointment, after)).toEqual({
        ok: false,
        error: 'Confirmação e cancelamento só são permitidos antes do horário da consulta',
      });
    });

    it('prioriza o erro de status final quando há mais de um problema', () => {
      expect(validateTransition('realizada', 'cancelada_paciente', appointment, after)).toEqual({
        ok: false,
        error: 'Status final não pode ser alterado',
      });
    });
  });
});