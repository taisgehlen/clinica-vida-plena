import type { ReactNode } from 'react';
import type { Indicators } from '../api/indicators';
import { formatNumber, formatPercent, formatPercentRounded } from '../utils/format';
import { Card } from './Card';

type Props = { summary: Indicators['summary']; schedule: Indicators['schedule']; className?: string };

function Tile({ label, value, note, tone = 'default' }: { label: string; value: string; note: ReactNode; tone?: 'default' | 'good' | 'pending' }) {
  return (
    <div className={`rounded-lg p-3.5 ${tone === 'pending' ? 'border border-dashed border-line' : 'bg-inner'}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${tone === 'good' ? 'text-good-text' : tone === 'pending' ? 'text-faint' : 'text-ink'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </div>
  );
}

export function OverviewCard({ summary, schedule, className }: Props) {
  const measured = summary.completed + summary.noShows;
  const share = (part: number) => (schedule.capacity === 0 ? '—' : formatPercentRounded(part / schedule.capacity));

  return (
    <Card title="Visão geral" className={className}>
      <div className="mt-4 grid gap-5 md:grid-cols-[200px_1fr] md:items-center">
        <div className="text-center">
          <p className="text-5xl font-bold tracking-tight">{formatPercent(summary.noShowRate)}</p>
          <p className="mt-1 text-xs text-muted">
            <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full bg-alert" />
            Taxa de falta
          </p>
          {summary.noShowRate !== null && (
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-inner" aria-hidden="true">
              <span className="bg-good" style={{ width: `${(1 - summary.noShowRate) * 100}%` }} />
              <span className="bg-alert" style={{ width: `${summary.noShowRate * 100}%` }} />
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            {formatNumber(summary.noShows)} faltas em {formatNumber(measured)} consultas encerradas
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          <Tile label="Horários na grade" value={formatNumber(schedule.capacity)} note="capacidade dos médicos no período" />
          <Tile label="Horários ocupados" value={formatNumber(schedule.occupied)} note={`${share(schedule.occupied)} da grade`} />
          <Tile label="Horários vagos" value={formatNumber(schedule.free)} note="ninguém agendou ou o cancelamento não foi reaproveitado" />
          <Tile label="Consultas realizadas" value={formatNumber(summary.completed)} note={`${share(summary.completed)} da grade`} tone="good" />
          <Tile
            label="Cancelamentos"
            value={formatNumber(schedule.cancellations.total)}
            note={
              <>
                <span className="font-semibold text-good-text">{formatNumber(schedule.cancellations.filled)} preenchidos</span> ·{' '}
                {formatNumber(schedule.cancellations.unfilled)} ficaram vagos
              </>
            }
          />
          <Tile label="Reagendamentos" value="—" note="o sistema antigo não registrava; passa a contar com a Parte 2" tone="pending" />
        </div>
      </div>
    </Card>
  );
}