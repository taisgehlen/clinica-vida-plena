import { useState } from 'react';
import type { Indicators, Period } from '../api/indicators';
import { useIndicators } from '../hooks/useIndicators';
import { formatDate, formatMonth, formatNumber } from '../utils/format';
import { PeriodFilter } from '../components/PeriodFilter';
import { OverviewCard } from '../components/OverviewCard';
import { HighlightsCard } from '../components/HighlightsCard';
import { DoctorScheduleCard } from '../components/DoctorScheduleCard';
import { MonthlyCard } from '../components/MonthlyCard';
import { LeadTimeCard } from '../components/LeadTimeCard';
import { WeekdayShiftCard } from '../components/WeekdayShiftCard';
import { RepeatPatientsCard } from '../components/RepeatPatientsCard';

function periodLabel(period: Period): string {
  if (!period.from && !period.to) return 'Todo o histórico importado';
  if (period.from && period.to) return `De ${formatDate(period.from)} a ${formatDate(period.to)}`;
  return period.from ? `A partir de ${formatDate(period.from)}` : `Até ${formatDate(period.to)}`;
}

function subtitle(period: Period, data: Indicators | null): string {
  if (!data) return periodLabel(period);
  const months = data.byMonth;
  const range = months.length > 0 ? ` de ${formatMonth(months[0]!.month)} a ${formatMonth(months[months.length - 1]!.month)}` : '';
  return `${periodLabel(period)} · ${formatNumber(data.summary.total)} consultas${range}`;
}

export function IndicatorsPage() {
  const [period, setPeriod] = useState<Period>({ from: '', to: '' });
  const { status, data, error, retry } = useIndicators(period);

  return (
    <>
      <div className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold">Faltas em consultas</h1>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-10 sm:px-6" aria-busy={status === 'loading'}>
        <p className="mb-4 text-sm text-muted" aria-live="polite">
          {status === 'loading' ? 'Carregando indicadores…' : subtitle(period, data)}
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-alert/40 bg-alert-soft px-4 py-3 text-sm">
            <p className="font-semibold">Não foi possível carregar os indicadores.</p>
            <p className="mt-0.5">{error}</p>
            <button type="button" onClick={retry} className="mt-2 font-semibold text-alert-text underline underline-offset-2">
              Tentar novamente
            </button>
          </div>
        )}

        {!data && status === 'loading' && <LoadingSkeleton />}

        {data && data.summary.total === 0 && (
          <p className="rounded-xl border border-line bg-card px-5 py-8 text-center">
            Nenhuma consulta neste período. Escolha outras datas ou volte para todo o histórico.
          </p>
        )}

        {data && data.summary.total > 0 && (
          <div className={`grid gap-4 transition-opacity lg:grid-cols-3 ${status === 'loading' ? 'opacity-50' : ''}`}>
            <OverviewCard summary={data.summary} schedule={data.schedule} className="lg:col-span-2" />
            <HighlightsCard data={data} className="lg:row-span-2" />
            <MonthlyCard months={data.byMonth} average={data.summary.noShowRate} className="lg:col-span-2" />
            <DoctorScheduleCard data={data} className="lg:col-span-2" />
            <LeadTimeCard buckets={data.byLeadTime} />
            <WeekdayShiftCard items={data.byWeekdayShift} />
            <RepeatPatientsCard patients={data.repeatNoShowPatients} className="lg:col-span-2" />
          </div>
        )}
      </main>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 motion-reduce:animate-none lg:grid-cols-3" aria-hidden="true">
      <div className="h-64 rounded-xl bg-line/60 lg:col-span-2" />
      <div className="h-64 rounded-xl bg-line/60" />
      <div className="h-48 rounded-xl bg-line/60 lg:col-span-2" />
    </div>
  );
}