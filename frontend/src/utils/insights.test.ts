import { describe, expect, it } from 'vitest';
import { compareVerdict, leadTimeSummary, shiftAgainstOthers, sumRates } from './insights';

const rate = (n: number, noShowRate: number) => {
  const noShows = Math.round(n * noShowRate);
  return { completed: n - noShows, noShows, noShowRate: noShows / n };
};

describe('compareVerdict', () => {
  it('diz que a diferença é grande a partir de 10 pontos', () => {
    expect(compareVerdict(rate(100, 0.47), rate(100, 0.3))).toEqual({ answer: 'sim', text: 'Sim. A diferença é grande.' });
  });

  it('conta os pontos quando a diferença é moderada', () => {
    expect(compareVerdict(rate(100, 0.37), rate(100, 0.3))).toEqual({ answer: 'sim', text: 'Sim. 7 pontos a mais.' });
  });

  it('diz que é praticamente igual quando a diferença é pequena', () => {
    expect(compareVerdict(rate(100, 0.32), rate(100, 0.31))).toEqual({ answer: 'nao', text: 'Não. Praticamente igual.' });
  });

  it('avisa quando é o contrário', () => {
    expect(compareVerdict(rate(100, 0.2), rate(100, 0.3)).text).toBe('Não. É o contrário: 10 pontos a menos.');
  });

  it('não responde com poucas consultas', () => {
    expect(compareVerdict(rate(10, 0.5), rate(100, 0.3)).answer).toBe('sem_dados');
  });
});

describe('sumRates e shiftAgainstOthers', () => {
  it('soma grupos e recalcula a taxa', () => {
    expect(sumRates([rate(10, 0.5), rate(30, 0.1)])).toEqual({ completed: 32, noShows: 8, noShowRate: 0.2 });
  });

  it('separa um turno de todos os outros', () => {
    const items = [
      { weekday: 'segunda', shift: 'manha', ...rate(100, 0.5) },
      { weekday: 'segunda', shift: 'tarde', ...rate(100, 0.3) },
      { weekday: 'terca', shift: 'manha', ...rate(100, 0.1) },
    ];
    const { group, others } = shiftAgainstOthers(items, 'segunda', 'manha');
    expect(group.noShowRate).toBe(0.5);
    expect(others.noShowRate).toBe(0.2);
  });
});

describe('leadTimeSummary', () => {
  it('compara quem marca longe com quem marca para os próximos dias', () => {
    const summary = leadTimeSummary([rate(100, 0.1), rate(100, 0.2), rate(200, 0.4)]);
    expect(summary.timesMore).toBeCloseTo(4);
    expect(summary.longShareOfAppointments).toBe(0.5);
    expect(summary.longShareOfNoShows).toBeCloseTo(80 / 110);
  });

  it('não calcula "vezes mais" sem consultas suficientes ou sem faltas na faixa curta', () => {
    expect(leadTimeSummary([rate(10, 0.1), rate(100, 0.4)]).timesMore).toBeNull();
    expect(leadTimeSummary([rate(100, 0), rate(100, 0.4)]).timesMore).toBeNull();
  });

  it('não quebra com lista vazia', () => {
    expect(leadTimeSummary([]).timesMore).toBeNull();
  });
});