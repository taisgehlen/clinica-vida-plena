import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Indicators } from '../api/indicators';
import { formatMonth, formatMonthShort, formatNumber, formatPercent, formatPercentRounded } from '../utils/format';
import { Card } from './Card';

type Props = { months: Indicators['byMonth']; average: number | null; className?: string };

type MonthPoint = Indicators['byMonth'][number] & { label: string };

const MAX_MONTHS = 12;
const AXIS_TICK = { fontSize: 11, className: 'fill-faint' };

function MonthTooltip({ point }: { point: MonthPoint }) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-ink">{formatMonth(point.month)}</p>
      <p className="text-muted">
        {formatPercent(point.noShowRate)} de falta · {formatNumber(point.noShows)} de {formatNumber(point.completed + point.noShows)}
      </p>
    </div>
  );
}

export function MonthlyCard({ months, average, className }: Props) {
  const shown: MonthPoint[] = months.slice(-MAX_MONTHS).map((m) => ({ ...m, label: formatMonthShort(m.month) }));
  const top = Math.max(0.5, ...shown.map((m) => m.noShowRate ?? 0));
  const last = shown[shown.length - 1];

  return (
    <Card title="Mês a mês" description="Taxa de falta por mês. É aqui que se vê o efeito de uma ação." className={className}>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhum mês com consultas encerradas no período.</p>
      ) : (
        <>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shown} margin={{ top: 16, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} className="stroke-line" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis
                  domain={[0, top]}
                  tickFormatter={(value: number) => formatPercentRounded(value)}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  width={44}
                />
                <Tooltip
                  cursor={{ className: 'fill-inner' }}
                  content={({ active, payload }) =>
                    active && payload?.[0] ? <MonthTooltip point={payload[0].payload as MonthPoint} /> : null
                  }
                />
                {average !== null && (
                  <ReferenceLine
                    y={average}
                    strokeDasharray="4 4"
                    className="stroke-muted"
                  />
                )}
                <Bar dataKey="noShowRate" name="Taxa de falta" className="fill-brand" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="sr-only">
            {shown.map((m) => (
              <li key={m.month}>
                {formatMonth(m.month)}: {formatPercent(m.noShowRate)}
              </li>
            ))}
          </ul>
          {average !== null && (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted">
              <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-muted" />
              Média do período: {formatPercent(average)}
            </p>
          )}
          {last && (
            <p className="mt-1 text-xs text-muted">
              {formatMonth(last.month)}: {formatNumber(last.noShows)} faltas em {formatNumber(last.completed + last.noShows)} consultas encerradas.
            </p>
          )}
        </>
      )}
    </Card>
  );
}