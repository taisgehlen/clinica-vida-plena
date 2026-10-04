import { describe, expect, it } from 'vitest';
import { formatDate, formatDecimal, formatMonth, formatMonthShort, formatNumber, formatPercent, formatPercentRounded } from './format';

describe('format', () => {
  it('formata porcentagem no padrão brasileiro', () => {
    expect(formatPercent(0.314)).toBe('31,4%');
    expect(formatPercent(0)).toBe('0,0%');
    expect(formatPercentRounded(0.466)).toBe('47%');
  });

  it('mostra traço quando não há o que medir', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercentRounded(null)).toBe('—');
  });

  it('formata números grandes com ponto de milhar e decimais com vírgula', () => {
    expect(formatNumber(7223)).toBe('7.223');
    expect(formatDecimal(3.49)).toBe('3,5');
  });

  it('formata mês e data', () => {
    expect(formatMonth('2026-03')).toBe('mar/26');
    expect(formatMonthShort('2026-03')).toBe('mar');
    expect(formatDate('2026-03-15')).toBe('15/03/2026');
  });
});