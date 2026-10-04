import type { Indicators } from '../api/indicators';
import { formatNumber, formatPercentRounded } from '../utils/format';
import { MIN_SAMPLE, measured } from '../utils/insights';
import { Card } from './Card';

type Props = { items: Indicators['byWeekdayShift']; className?: string };

const DAYS = [
  { id: 'segunda', label: 'Seg', name: 'Segunda' },
  { id: 'terca', label: 'Ter', name: 'Terça' },
  { id: 'quarta', label: 'Qua', name: 'Quarta' },
  { id: 'quinta', label: 'Qui', name: 'Quinta' },
  { id: 'sexta', label: 'Sex', name: 'Sexta' },
  { id: 'sabado', label: 'Sáb', name: 'Sábado' },
];
const SHIFTS = [
  { id: 'manha', label: 'Manhã', name: 'de manhã' },
  { id: 'tarde', label: 'Tarde', name: 'à tarde' },
] as const;

export function WeekdayShiftCard({ items, className }: Props) {
  const find = (day: string, shift: string) => items.find((i) => i.weekday === day && i.shift === shift);
  const reliable = items.filter((i) => measured(i) >= MIN_SAMPLE && i.noShowRate !== null);
  const rates = reliable.map((i) => i.noShowRate!);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const worst = reliable.find((i) => i.noShowRate === max);
  const hasSmallCells = items.some((i) => measured(i) < MIN_SAMPLE);

  const background = (rate: number) => {
    const strength = max === min ? 0.5 : (rate - min) / (max - min);
    return `rgb(31 120 193 / ${(0.15 + strength * 0.4).toFixed(2)})`;
  };

  return (
    <Card title="Dia e turno" description="Taxa de falta. Quanto mais forte a cor, mais faltas." className={className}>
      <table className="mt-4 w-full table-fixed border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <td className="w-14" />
            {DAYS.map((d) => (
              <th key={d.id} scope="col" className="font-normal text-faint">
                <abbr title={d.name} className="no-underline">{d.label}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHIFTS.map((shift) => (
            <tr key={shift.id}>
              <th scope="row" className="pr-1 text-right font-normal text-muted">{shift.label}</th>
              {DAYS.map((day) => {
                const cell = find(day.id, shift.id);
                const ok = cell && measured(cell) >= MIN_SAMPLE && cell.noShowRate !== null;
                const isWorst = ok && cell === worst;
                return (
                  <td
                    key={day.id}
                    className={`rounded-md py-2.5 text-center font-bold ${!ok ? 'bg-inner text-faint' : isWorst ? 'bg-alert text-white' : 'text-ink'}`}
                    style={ok && !isWorst ? { backgroundColor: background(cell.noShowRate!) } : undefined}
                  >
                    {ok ? formatPercentRounded(cell.noShowRate) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-muted">
        {worst && (
          <>
            {DAYS.find((d) => d.id === worst.weekday)?.name} {SHIFTS.find((s) => s.id === worst.shift)?.name}:{' '}
            {formatNumber(worst.noShows)} faltas em {formatNumber(measured(worst))} consultas.{' '}
          </>
        )}
        {hasSmallCells && '— poucas consultas para calcular.'}
      </p>
    </Card>
  );
}