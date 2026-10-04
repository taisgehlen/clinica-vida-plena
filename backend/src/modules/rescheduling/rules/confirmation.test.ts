import { describe, expect, it } from 'vitest';
import {
  confirmationSendDate,
  isHighRisk,
  leadTimeDays,
  needsConfirmation,
  nextConfirmationStep,
  type ConfirmationCandidate,
} from './confirmation.js';

const consulta = new Date(2026, 9, 8, 14, 0);

const base: ConfirmationCandidate = {
  status: 'agendada',
  patientPhone: '49991231234',
  bookedAt: new Date(2026, 8, 10, 10, 0),
  scheduledAt: consulta,
};

describe('leadTimeDays e isHighRisk', () => {
  it('conta os dias de calendário entre marcar e a consulta', () => {
    expect(leadTimeDays(new Date(2026, 9, 1, 23, 0), new Date(2026, 9, 2, 8, 0))).toBe(1);
  });

  it('considera risco alto a partir de 15 dias', () => {
    expect(isHighRisk({ bookedAt: new Date(2026, 8, 23), scheduledAt: consulta })).toBe(true);
    expect(isHighRisk({ bookedAt: new Date(2026, 8, 24), scheduledAt: consulta })).toBe(false);
  });
});

describe('confirmationSendDate', () => {
  it('é a meia-noite de 2 dias antes da consulta', () => {
    expect(confirmationSendDate(consulta)).toEqual(new Date(2026, 9, 6, 0, 0));
  });
});

describe('needsConfirmation', () => {
  const twoDaysBefore = new Date(2026, 9, 6, 9, 0);

  it('pede confirmação de consulta de risco a partir de 2 dias antes', () => {
    expect(needsConfirmation(base, twoDaysBefore)).toBe(true);
  });

  it('ainda não pede 3 dias antes', () => {
    expect(needsConfirmation(base, new Date(2026, 9, 5, 23, 59))).toBe(false);
  });

  it('não pede para quem marcou com menos de 15 dias', () => {
    expect(needsConfirmation({ ...base, bookedAt: new Date(2026, 8, 30) }, twoDaysBefore)).toBe(false);
  });

  it('não pede para consulta já confirmada ou cancelada', () => {
    expect(needsConfirmation({ ...base, status: 'confirmada' }, twoDaysBefore)).toBe(false);
    expect(needsConfirmation({ ...base, status: 'cancelada_paciente' }, twoDaysBefore)).toBe(false);
  });

  it('não pede para paciente sem telefone', () => {
    expect(needsConfirmation({ ...base, patientPhone: null }, twoDaysBefore)).toBe(false);
  });

  it('não pede quando faltam 12 horas ou menos para a consulta', () => {
    expect(needsConfirmation(base, new Date(2026, 9, 8, 2, 0))).toBe(false);
  });
});

describe('nextConfirmationStep', () => {
  const sentAt = new Date(2026, 9, 6, 9, 0);

  it('espera enquanto falta mais de 24 horas', () => {
    expect(nextConfirmationStep({ scheduledAt: consulta, sentAt, reminderSentAt: null }, new Date(2026, 9, 7, 13, 0))).toBe('wait');
  });

  it('manda o 2º lembrete quando faltam 24 horas', () => {
    expect(nextConfirmationStep({ scheduledAt: consulta, sentAt, reminderSentAt: null }, new Date(2026, 9, 7, 14, 0))).toBe('send_reminder');
  });

  it('não manda o 2º lembrete duas vezes', () => {
    const reminderSentAt = new Date(2026, 9, 7, 14, 0);
    expect(nextConfirmationStep({ scheduledAt: consulta, sentAt, reminderSentAt }, new Date(2026, 9, 7, 20, 0))).toBe('wait');
  });

  it('não manda o 2º lembrete logo depois do 1º pedido', () => {
    const lateSentAt = new Date(2026, 9, 7, 16, 0);
    expect(nextConfirmationStep({ scheduledAt: consulta, sentAt: lateSentAt, reminderSentAt: null }, new Date(2026, 9, 7, 17, 0))).toBe('wait');
  });

  it('marca sem resposta quando faltam 12 horas', () => {
    const reminderSentAt = new Date(2026, 9, 7, 14, 0);
    expect(nextConfirmationStep({ scheduledAt: consulta, sentAt, reminderSentAt }, new Date(2026, 9, 8, 2, 0))).toBe('mark_no_answer');
  });
});