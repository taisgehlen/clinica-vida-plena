import { useState } from 'react';
import { cancelOffer, type VacancyItem } from '../api/rescheduling';
import { errorMessage } from '../api/client';
import { useNow } from '../hooks/useNow';
import { daysLabel, formatDayTime, formatRemaining, formatShortDate } from '../utils/datetime';
import { firstName, SKIP_LABELS, vacancyOrigin } from '../utils/rescheduling';
import { StatusPill } from './StatusPill';

type Props = { vacancies: VacancyItem[]; onChanged: () => void };

function VacancyStatus({ vacancy, now }: { vacancy: VacancyItem; now: number }) {
  if (vacancy.status === 'oferecida' && vacancy.pendingOffer) {
    return (
      <StatusPill tone="teal">
        Convite com {firstName(vacancy.pendingOffer.patientName)} · {formatRemaining(vacancy.pendingOffer.expiresAt, now)}
      </StatusPill>
    );
  }
  if (vacancy.status === 'preenchida') return <StatusPill tone="good">✓ Antecipada para {vacancy.filledBy}</StatusPill>;
  if (vacancy.status === 'sem_fila') return <StatusPill tone="neutral">Ninguém na fila: livre para agendamento</StatusPill>;
  if (vacancy.status === 'em_cima_da_hora') return <StatusPill tone="warn">Menos de 3 h: encaixe pela recepção</StatusPill>;
  return <StatusPill tone="warn">Procurando paciente…</StatusPill>;
}

function QueueTable({ vacancy }: { vacancy: VacancyItem }) {
  const positions = vacancy.queue.map((entry, index) => (entry.skip ? null : vacancy.queue.slice(0, index + 1).filter((e) => !e.skip).length));
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-xs text-faint">
            <th scope="col" className="py-1.5 pr-2 font-semibold">#</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">Paciente</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">Consulta atual</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">Ganha</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">Marcou em</th>
            <th scope="col" className="py-1.5 font-semibold">
              <span className="sr-only">Situação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vacancy.queue.map((entry, index) => {
            const invited = vacancy.pendingOffer?.patientName === entry.patientName;
            const reason = entry.skip === 'already_offered' && invited ? 'convite enviado' : entry.skip ? SKIP_LABELS[entry.skip] : '';
            return (
              <tr key={entry.appointmentId} className={`border-b border-line last:border-0 ${entry.skip ? 'text-faint' : ''}`}>
                <td className="py-1.5 pr-2 font-bold text-brand">{positions[index] ? `${positions[index]}º` : '—'}</td>
                <td className="py-1.5 pr-2">{entry.patientName}</td>
                <td className="py-1.5 pr-2">{formatShortDate(entry.scheduledAt)}</td>
                <td className="py-1.5 pr-2">+{daysLabel(Math.max(0, entry.gainDays))}</td>
                <td className="py-1.5 pr-2">{formatShortDate(entry.bookedAt)}</td>
                <td className="py-1.5 text-xs">{reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Vacancy({ vacancy, now, onChanged }: { vacancy: VacancyItem; now: number; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const waiting = vacancy.status === 'oferecida' || vacancy.status === 'aberta';
  const eligible = vacancy.queue.filter((entry) => !entry.skip);
  const next = eligible[0];

  const cancel = async () => {
    if (!vacancy.pendingOffer) return;
    setBusy(true);
    setError(null);
    try {
      await cancelOffer(vacancy.pendingOffer.offerId);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível cancelar o convite.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {formatDayTime(vacancy.scheduledAt)} · {vacancy.doctorName}
          </p>
          <p className="text-[13px] text-muted">{vacancyOrigin(vacancy)}</p>
        </div>
        <VacancyStatus vacancy={vacancy} now={now} />
      </div>

      {waiting && (
        <p className="mt-3 text-[13px] text-muted">
          {next ? (
            <>
              {vacancy.pendingOffer ? `Se ${firstName(vacancy.pendingOffer.patientName)} não aceitar: ` : 'Próximo da fila: '}
              <b className="text-ink">{next.patientName}</b> (ganha {daysLabel(Math.max(0, next.gainDays))})
              {eligible.length > 1 && ` · mais ${eligible.length - 1} na fila`}
            </>
          ) : (
            'Ninguém mais na fila depois deste convite.'
          )}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {vacancy.queue.length > 0 && (
          <button
            type="button"
            aria-expanded={showQueue}
            onClick={() => setShowQueue((open) => !open)}
            className="text-[13px] font-semibold text-teal hover:underline"
          >
            {showQueue ? 'Esconder fila' : `Ver fila (${vacancy.queue.length}) →`}
          </button>
        )}
        {vacancy.pendingOffer && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="text-[13px] font-semibold text-alert-text hover:underline disabled:opacity-50"
          >
            Cancelar convite
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-alert-text">
          {error}
        </p>
      )}
      {showQueue && <QueueTable vacancy={vacancy} />}
    </li>
  );
}

const ACTIVE: VacancyItem['status'][] = ['aberta', 'oferecida', 'em_cima_da_hora'];

export function VacancyList({ vacancies, onChanged }: Props) {
  const now = useNow();
  const [showDone, setShowDone] = useState(false);
  const active = vacancies.filter((v) => ACTIVE.includes(v.status));
  const done = vacancies.filter((v) => !ACTIVE.includes(v.status));

  return (
    <div>
      {active.length === 0 ? (
        <p className="rounded-lg bg-inner px-4 py-3 text-sm text-muted">
          Nenhuma vaga esperando resposta agora. Quando um paciente avisar que não vem, a vaga aparece aqui e o convite sai sozinho.
        </p>
      ) : (
        <ul className="space-y-3">
          {active.map((vacancy) => (
            <Vacancy key={vacancy.id} vacancy={vacancy} now={now} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showDone}
            onClick={() => setShowDone((open) => !open)}
            className="mt-3 text-[13px] font-bold text-teal hover:underline"
          >
            {showDone ? 'Esconder concluídas' : `✓ Concluídas (${done.length}) — mostrar`}
          </button>
          {showDone && (
            <ul className="mt-3 space-y-3">
              {done.map((vacancy) => (
                <Vacancy key={vacancy.id} vacancy={vacancy} now={now} onChanged={onChanged} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
