import { describe, it, expect } from 'vitest';
import { normalizeStatus, normalizeServiceType, parseDateTime, normalizePhone } from './normalize.js';

describe('normalizeStatus', () => {
  it.each([
    ['realizada', 'realizada'],
    ['Realizada', 'realizada'],
    ['REALIZADA', 'realizada'],
    ['atendido', 'realizada'],
    ['falta', 'falta'],
    ['FALTA', 'falta'],
    ['faltou', 'falta'],
    ['no_show', 'falta'],
    ['ausente', 'falta'],
    ['Agendada', 'agendada'],
    ['confirmado', 'confirmada'],
    ['cancelada_paciente', 'cancelada_paciente'],
    ['cancelado pelo paciente', 'cancelada_paciente'],
    ['desmarcou', 'cancelada_paciente'],
    ['cancelado clinica', 'cancelada_clinica'],
    ['cancelada_clinica', 'cancelada_clinica'],
    ['  realizada  ', 'realizada'],
  ])('converte "%s" em %s', (raw, expected) => {
    expect(normalizeStatus(raw)).toEqual({ status: expected, assumedPatientCancellation: false });
  });

  it('assume cancelamento do paciente quando "cancelado" não diz quem cancelou', () => {
    expect(normalizeStatus('cancelado')).toEqual({
      status: 'cancelada_paciente',
      assumedPatientCancellation: true,
    });
  });

  it('devolve null para status vazio', () => {
    expect(normalizeStatus('')).toBeNull();
    expect(normalizeStatus('   ')).toBeNull();
    expect(normalizeStatus(undefined)).toBeNull();
  });

  it('devolve null para status desconhecido', () => {
    expect(normalizeStatus('remarcada')).toBeNull();
  });
});

describe('normalizeServiceType', () => {
  it.each([
    ['convenio', 'convenio'],
    ['Convênio', 'convenio'],
    ['CONVENIO', 'convenio'],
    ['convênio', 'convenio'],
    ['particular', 'particular'],
    ['PARTICULAR', 'particular'],
  ])('converte "%s" em %s', (raw, expected) => {
    expect(normalizeServiceType(raw)).toBe(expected);
  });

  it('devolve null para tipo desconhecido', () => {
    expect(normalizeServiceType('sus')).toBeNull();
    expect(normalizeServiceType('')).toBeNull();
  });
});

describe('parseDateTime', () => {
  it('lê o formato ISO sem inverter dia e mês', () => {
    const parsed = parseDateTime('2025-10-02 15:00');
    expect(parsed?.format).toBe('iso');
    expect(parsed?.date).toEqual(new Date(2025, 9, 2, 15, 0));
  });

  it('lê o formato brasileiro (dia/mês/ano)', () => {
    const parsed = parseDateTime('02/10/2025 15:00');
    expect(parsed?.format).toBe('br');
    expect(parsed?.date).toEqual(new Date(2025, 9, 2, 15, 0));
  });

  it('os dois formatos da mesma data dão o mesmo resultado', () => {
    expect(parseDateTime('2025-08-12 12:48')?.date).toEqual(parseDateTime('12/08/2025 12:48')?.date);
  });

  it('rejeita data impossível em vez de pular para o mês seguinte', () => {
    expect(parseDateTime('31/02/2026 10:00')).toBeNull();
    expect(parseDateTime('2026-13-01 10:00')).toBeNull();
  });

  it('rejeita formatos desconhecidos', () => {
    expect(parseDateTime('2025/10/02 15:00')).toBeNull();
    expect(parseDateTime('ontem')).toBeNull();
    expect(parseDateTime('')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it.each([
    ['(53) 96470-3160', '53964703160'],
    ['54912341342', '54912341342'],
    ['+55 53 998575311', '53998575311'],
    ['5332221100', '5332221100'],
  ])('normaliza "%s" para %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it('devolve null para telefone curto demais', () => {
    expect(normalizePhone('91234')).toBeNull();
    expect(normalizePhone('912345')).toBeNull();
  });

  it('devolve null para texto ou vazio', () => {
    expect(normalizePhone('sem telefone')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});