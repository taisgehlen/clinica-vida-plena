import type { DoctorSchedule, Indicators } from '../api/indicators';
import { formatNumber, formatPercent, formatPercentRounded } from '../utils/format';
import { Card } from './Card';

type Props = { data: Indicators; className?: string };

function OccupancyBar({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-inner" aria-hidden="true">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${(rate ?? 0) * 100}%` }} />
      </span>
      <span className="w-9 text-xs text-muted">
        <span className="sr-only">Ocupação </span>
        {formatPercentRounded(rate)}
      </span>
    </div>
  );
}

function Slots({ schedule }: { schedule: DoctorSchedule | undefined }) {
  if (!schedule) return <>—</>;
  return (
    <>
      {formatNumber(schedule.occupied)} <span className="text-xs text-faint">de {formatNumber(schedule.capacity)}</span>
    </>
  );
}

function RatePill({ rate, above }: { rate: number | null; above: boolean }) {
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${above ? 'bg-alert-soft text-alert-text' : 'bg-inner text-ink'}`}>
      {formatPercent(rate)}
      {above && <span className="sr-only"> (acima da média)</span>}
    </span>
  );
}

export function DoctorScheduleCard({ data, className }: Props) {
  const average = data.summary.noShowRate;
  const rows = data.byDoctor
    .map((doctor) => ({ ...doctor, schedule: data.schedule.byDoctor.find((s) => s.doctorId === doctor.doctorId) }))
    .sort((a, b) => (b.noShowRate ?? -1) - (a.noShowRate ?? -1));

  const isAbove = (rate: number | null) => rate !== null && average !== null && rate > average;

  return (
    <Card
      title="Agenda por médico"
      description={`Ordenado pela taxa de falta. Em rosa, quem está acima da média da clínica (${formatPercent(average)}).`}
      className={className}
    >
      <table className="mt-3 hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-faint">
            <th scope="col" className="py-2 font-semibold">Médico</th>
            <th scope="col" className="w-[32%] py-2 font-semibold">Ocupação da agenda</th>
            <th scope="col" className="py-2 text-right font-semibold">Horários ocupados</th>
            <th scope="col" className="py-2 text-right font-semibold">Faltas</th>
            <th scope="col" className="py-2 text-right font-semibold">Taxa de falta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.doctorId} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-2.5 text-left font-semibold">
                {row.name}
                <span className="block text-xs font-normal text-faint">{row.specialty}</span>
              </th>
              <td className="py-2.5 pr-6">
                <OccupancyBar rate={row.schedule?.occupancyRate ?? null} />
              </td>
              <td className="py-2.5 text-right">
                <Slots schedule={row.schedule} />
              </td>
              <td className="py-2.5 text-right">{formatNumber(row.noShows)}</td>
              <td className="py-2.5 text-right">
                <RatePill rate={row.noShowRate} above={isAbove(row.noShowRate)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-3 md:hidden">
        {rows.map((row) => (
          <li key={row.doctorId} className="border-b border-line py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">
                {row.name}
                <span className="block text-xs font-normal text-faint">{row.specialty}</span>
              </p>
              <RatePill rate={row.noShowRate} above={isAbove(row.noShowRate)} />
            </div>
            <div className="mt-2">
              <OccupancyBar rate={row.schedule?.occupancyRate ?? null} />
            </div>
            <p className="mt-1 text-xs text-muted">
              <Slots schedule={row.schedule} /> horários ocupados · {formatNumber(row.noShows)} faltas
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}