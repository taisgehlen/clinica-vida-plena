import type { Rate } from '../api/indicators';

export const MIN_SAMPLE = 30;

export const measured = (rate: Rate) => rate.completed + rate.noShows;

export function sumRates(items: Rate[]): Rate {
  const completed = items.reduce((sum, r) => sum + r.completed, 0);
  const noShows = items.reduce((sum, r) => sum + r.noShows, 0);
  const total = completed + noShows;
  return { completed, noShows, noShowRate: total === 0 ? null : noShows / total };
}

export type Verdict = { answer: 'sim' | 'nao' | 'sem_dados'; text: string };

export function compareVerdict(group: Rate, others: Rate): Verdict {
  if (
    measured(group) < MIN_SAMPLE ||
    measured(others) < MIN_SAMPLE ||
    group.noShowRate === null ||
    others.noShowRate === null
  ) {
    return { answer: 'sem_dados', text: 'Poucas consultas no período para responder.' };
  }
  const points = Math.round((group.noShowRate - others.noShowRate) * 100);
  if (points >= 10) return { answer: 'sim', text: 'Sim. A diferença é grande.' };
  if (points >= 3) return { answer: 'sim', text: `Sim. ${points} pontos a mais.` };
  if (points > -3) return { answer: 'nao', text: 'Não. Praticamente igual.' };
  return { answer: 'nao', text: `Não. É o contrário: ${-points} pontos a menos.` };
}

export function shiftAgainstOthers(
  items: (Rate & { weekday: string; shift: string })[],
  weekday: string,
  shift: string,
): { group: Rate; others: Rate } {
  const isTarget = (r: { weekday: string; shift: string }) => r.weekday === weekday && r.shift === shift;
  return { group: sumRates(items.filter(isTarget)), others: sumRates(items.filter((r) => !isTarget(r))) };
}

export type LeadTimeSummary = {
  timesMore: number | null;
  longShareOfAppointments: number | null;
  longShareOfNoShows: number | null;
  longNoShows: number;
  totalNoShows: number;
};

export function leadTimeSummary(buckets: Rate[]): LeadTimeSummary {
  const short = buckets[0];
  const long = buckets[buckets.length - 1];
  const total = sumRates(buckets);
  if (!short || !long) {
    return { timesMore: null, longShareOfAppointments: null, longShareOfNoShows: null, longNoShows: 0, totalNoShows: 0 };
  }
  const comparable =
    measured(short) >= MIN_SAMPLE && measured(long) >= MIN_SAMPLE && !!short.noShowRate && long.noShowRate !== null;
  return {
    timesMore: comparable ? long.noShowRate! / short.noShowRate! : null,
    longShareOfAppointments: measured(total) === 0 ? null : measured(long) / measured(total),
    longShareOfNoShows: total.noShows === 0 ? null : long.noShows / total.noShows,
    longNoShows: long.noShows,
    totalNoShows: total.noShows,
  };
}