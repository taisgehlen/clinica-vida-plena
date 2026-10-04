import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Indicators } from '../api/indicators';
import { formatDecimal, formatNumber, formatPercent, formatPercentRounded } from '../utils/format';
import { leadTimeSummary } from '../utils/insights';
import { Card } from './Card';

type Props = { buckets: Indicators['byLeadTime']; className?: string };

type BucketPoint = Indicators['byLeadTime'][number] & { label: string; per100: string; color: string };

const LABELS: Record<string, string> = {
  '0-3 dias': 'Até 3 dias',
  '4-7 dias': '4 a 7 dias',
  '8-14 dias': '8 a 14 dias',
  '15+ dias': '15 dias ou mais',
};

function BucketTooltip({ point }: { point: BucketPoint }) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-ink">Marcadas com {point.label.toLowerCase()} de antecedência</p>
      <p className="text-muted">
        {formatPercent(point.noShowRate)} de falta · {formatNumber(point.noShows)} de {formatNumber(point.completed + point.noShows)}
      </p>
    </div>
  );
}

export function LeadTimeCard({ buckets, className }: Props) {
  const summary = leadTimeSummary(buckets);
  const lastIndex = buckets.length - 1;
  const color = (index: number) => (index === 0 ? 'fill-good' : index === lastIndex ? 'fill-alert' : 'fill-brand');

  const data: BucketPoint[] = buckets.map((bucket, index) => ({
    ...bucket,
    label: LABELS[bucket.bucket] ?? bucket.bucket,
    per100: bucket.noShowRate === null ? '—' : `${Math.round(bucket.noShowRate * 100)} em 100`,
    color: color(index),
  }));
  const byLabel = new Map(data.map((d) => [d.label, d]));

  const headline =
    summary.timesMore !== null && summary.timesMore >= 1.5
      ? `Quem marca com mais de 2 semanas falta ${formatDecimal(summary.timesMore)} vezes mais do que quem marca para os próximos 3 dias.`
      : 'Veja como os dias entre marcar e a consulta mudam a taxa de falta.';

  const showFooter =
    summary.longShareOfNoShows !== null &&
    summary.longShareOfAppointments !== null &&
    summary.longShareOfNoShows > summary.longShareOfAppointments;

  return (
    <Card title="Antecedência do agendamento" className={className}>
      <p className="mt-2 text-sm font-bold leading-snug">{headline}</p>
      <p className="mt-1 text-xs text-muted">De cada 100 consultas, quantas terminaram em falta</p>

      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="30%">
            <XAxis type="number" domain={[0, 0.75]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={108}
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload }) => {
                const point = byLabel.get(String(payload.value));
                return (
                  <g transform={`translate(${Number(x) - 100},${Number(y)})`}>
                    <text x={0} y={-2} fontSize={13} className="fill-ink">
                      {String(payload.value)}
                    </text>
                    <text x={0} y={14} fontSize={11} className="fill-faint">
                      {point ? `${formatNumber(point.noShows)} faltas` : ''}
                    </text>
                  </g>
                );
              }}
            />
            <Tooltip
              cursor={{ className: 'fill-inner' }}
              content={({ active, payload }) =>
                active && payload?.[0] ? <BucketTooltip point={payload[0].payload as BucketPoint} /> : null
              }
            />
            <Bar dataKey="noShowRate" name="Taxa de falta" radius={99} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.bucket} className={d.color} />
              ))}
              <LabelList dataKey="per100" position="right" fontSize={13} fontWeight={700} className="fill-ink" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.bucket}>
            {d.label}: {d.per100}, {formatNumber(d.noShows)} faltas
          </li>
        ))}
      </ul>

      {showFooter && (
        <p className="mt-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm leading-snug">
          Consultas marcadas com mais de 2 semanas são <b>{formatPercentRounded(summary.longShareOfAppointments)} das consultas</b>, mas geram{' '}
          <b>{formatPercentRounded(summary.longShareOfNoShows)} das faltas</b> ({formatNumber(summary.longNoShows)} de{' '}
          {formatNumber(summary.totalNoShows)}).
        </p>
      )}
    </Card>
  );
}