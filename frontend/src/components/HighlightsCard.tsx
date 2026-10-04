import type { Indicators, Rate } from '../api/indicators';
import { formatNumber, formatPercentRounded } from '../utils/format';
import { compareVerdict, shiftAgainstOthers } from '../utils/insights';
import { Card } from './Card';

type Props = { data: Indicators; className?: string };

type Comparison = {
  question: string;
  rows: [{ label: string; rate: Rate }, { label: string; rate: Rate }];
};

function ComparisonBlock({ question, rows }: Comparison) {
  const verdict = compareVerdict(rows[0].rate, rows[1].rate);
  const color = (index: number) => (index === 0 && verdict.answer === 'sim' ? 'bg-alert' : 'bg-brand-mid');
  const [answer, ...rest] = verdict.text.split(' ');

  return (
    <div className="border-b border-line py-3 last:border-b-0">
      <p className="text-sm font-semibold">{question}</p>
      <dl className="mt-2 space-y-1.5">
        {rows.map((row, index) => (
          <div key={row.label} className="grid grid-cols-[118px_1fr_36px] items-center gap-2 text-xs text-muted">
            <dt>{row.label}</dt>
            <dd className="h-2 overflow-hidden rounded-full bg-inner" aria-hidden="true">
              <span className={`block h-full rounded-full ${color(index)}`} style={{ width: `${Math.min(100, (row.rate.noShowRate ?? 0) * 200)}%` }} />
            </dd>
            <dd className="text-right font-bold text-ink">{formatPercentRounded(row.rate.noShowRate)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-xs text-muted">
        <b className="text-ink">{answer}</b> {rest.join(' ')}
      </p>
    </div>
  );
}

export function HighlightsCard({ data, className }: Props) {
  const monday = shiftAgainstOthers(data.byWeekdayShift, 'segunda', 'manha');
  const first = data.byFirstVisit.find((g) => g.group === 'primeira_consulta');
  const returning = data.byFirstVisit.find((g) => g.group === 'recorrente');
  const insurance = data.byServiceType.find((g) => g.serviceType === 'convenio');
  const privatePay = data.byServiceType.find((g) => g.serviceType === 'particular');
  const pending = data.summary.pendingClosure;

  const comparisons: Comparison[] = [
    {
      question: '…segunda de manhã é o pior horário?',
      rows: [
        { label: 'Segunda de manhã', rate: monday.group },
        { label: 'Demais turnos', rate: monday.others },
      ],
    },
  ];
  if (first && returning) {
    comparisons.push({
      question: '…paciente novo falta mais?',
      rows: [
        { label: 'Primeira consulta', rate: first },
        { label: 'Já é paciente', rate: returning },
      ],
    });
  }
  if (insurance && privatePay) {
    comparisons.push({
      question: '…paciente de convênio falta mais?',
      rows: [
        { label: 'Convênio', rate: insurance },
        { label: 'Particular', rate: privatePay },
      ],
    });
  }

  return (
    <Card title="Destaques" className={className}>
      {pending > 0 && (
        <p className="mt-3 flex gap-2 rounded-lg border border-warn-line bg-warn-bg px-3 py-2.5 text-sm">
          <span aria-hidden="true">⚠</span>
          <span>
            <b className="text-warn-text">
              {pending === 1 ? '1 consulta que já passou está sem status.' : `${formatNumber(pending)} consultas que já passaram estão sem status.`}
            </b>{' '}
            Isso deixa as taxas imprecisas.
          </span>
        </p>
      )}

      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">É verdade que…</p>
      {comparisons.map((c) => (
        <ComparisonBlock key={c.question} {...c} />
      ))}

      <div className="mt-3 rounded-lg bg-brand-soft px-3 py-2.5 text-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-brand">O que ninguém tinha percebido</p>
        <p className="mt-1">
          O que mais explica as faltas é a antecedência: quanto mais longe a consulta é marcada, mais o paciente falta. Veja no
          card Antecedência.
        </p>
      </div>
    </Card>
  );
}