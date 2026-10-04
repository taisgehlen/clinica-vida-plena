import { useState, type ReactNode } from 'react';
import { errorMessage } from '../api/client';
import { acceptAnticipation, declineAnticipation, getAnticipation, type Anticipation } from '../api/rescheduling';
import { useResource } from '../hooks/useResource';
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '../utils/calendar';
import { daysLabel, formatHour, formatLong, formatShortDate } from '../utils/datetime';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
        <p className="flex items-center gap-2 text-sm font-extrabold text-brand">
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-lg bg-brand text-xs text-white">
            VP
          </span>
          Clínica Vida Plena
        </p>
        {children}
      </main>
    </div>
  );
}

function AppointmentCard({ label, data, previous }: { label: string; data: Anticipation; previous: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="bg-brand-soft px-4 py-3.5">
        <p className="text-xs font-bold tracking-wide text-brand uppercase">{label}</p>
        <p className="mt-1 text-xl font-bold">{formatLong(data.newScheduledAt)}</p>
      </div>
      {previous && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-xs font-bold tracking-wide text-faint uppercase">Sua consulta atual</p>
          <p className="mt-0.5 text-faint line-through">{formatLong(data.currentScheduledAt)}</p>
        </div>
      )}
      <div className="border-t border-line px-4 py-3 text-sm text-muted">
        <b className="text-ink">{data.doctorName}</b> · {data.specialty}
        <br />
        Clínica Vida Plena
      </div>
    </div>
  );
}

function CalendarButtons({ data, token }: { data: Anticipation; token: string }) {
  const event: CalendarEvent = {
    title: `Consulta – ${data.doctorName}`,
    details: `${data.specialty} na Clínica Vida Plena`,
    location: 'Clínica Vida Plena',
    start: new Date(data.newScheduledAt),
    minutes: 30,
  };
  return (
    <div className="flex flex-col gap-2">
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-brand py-3.5 text-center text-base font-bold text-white hover:bg-brand/90"
      >
        📅 Salvar no Google Agenda
      </a>
      <button
        type="button"
        onClick={() => downloadIcs(event, token.slice(0, 16))}
        className="rounded-xl bg-inner py-3.5 text-base font-bold hover:bg-line"
      >
        Outro calendário (iPhone, Outlook)
      </button>
    </div>
  );
}

export function AnticipationPage({ token }: { token: string }) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const anticipation = useResource(`${token}|${version}`, (signal) => getAnticipation(token, signal));
  const data = anticipation.data;

  const act = async (action: (t: string) => Promise<Anticipation>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action(token);
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível registrar sua resposta. Tente novamente.'));
    } finally {
      setBusy(false);
      setVersion((n) => n + 1);
    }
  };

  if (!data && anticipation.loading) {
    return (
      <Shell>
        <p className="text-muted">Carregando…</p>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Link inválido</h1>
        <p className="text-muted">
          {anticipation.error && !anticipation.error.includes('não encontrada')
            ? anticipation.error
            : 'Não encontramos este convite. Confira se o link está completo ou fale com a recepção pelo WhatsApp.'}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {data.status === 'pendente' && (
        <>
          <h1 className="text-2xl font-bold">Antecipe sua consulta</h1>
          <p className="leading-relaxed text-muted">
            Olá, {data.patientFirstName}! Abriu um horário com {data.doctorName.startsWith('Dra.') ? 'a' : 'o'} {data.doctorName} antes da data da sua consulta.
            Ele está reservado para você até as <b className="text-ink">{formatHour(data.expiresAt)}</b>.
          </p>
          <AppointmentCard label="Novo horário" data={data} previous />
          <p className="self-start rounded-full bg-good/15 px-3 py-1 text-sm font-bold text-good-text">
            Sua consulta fica {daysLabel(data.gainDays)} mais cedo
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(acceptAnticipation)}
            className="rounded-xl bg-brand py-3.5 text-base font-bold text-white hover:bg-brand/90 disabled:opacity-50"
          >
            Confirmar novo horário
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(declineAnticipation)}
            className="rounded-xl bg-inner py-3.5 text-base font-bold hover:bg-line disabled:opacity-50"
          >
            Manter minha consulta atual
          </button>
          <p className="rounded-xl bg-card px-4 py-3 text-[13px] leading-relaxed text-muted">
            <b className="text-ink">Como funciona:</b> ao confirmar, sua consulta passa para o novo horário e a data atual é liberada para
            outro paciente. Se você não confirmar até as {formatHour(data.expiresAt)} de {formatShortDate(data.expiresAt)}, nada muda.
          </p>
        </>
      )}

      {data.status === 'aceita' && (
        <>
          <p aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-good/15 text-3xl font-bold text-good-text">
            ✓
          </p>
          <h1 className="text-2xl font-bold">Consulta antecipada!</h1>
          <p className="text-muted">Tudo certo, {data.patientFirstName}. Esperamos você no novo horário.</p>
          <AppointmentCard label="Sua consulta" data={data} previous={false} />
          <CalendarButtons data={data} token={token} />
          <p className="rounded-xl bg-card px-4 py-3 text-[13px] leading-relaxed text-muted">
            Chegue com <b className="text-ink">15 minutos de antecedência</b> e traga um documento com foto e a carteirinha do convênio, se tiver.
            Precisa remarcar? Responda a mensagem no WhatsApp.
          </p>
        </>
      )}

      {data.status === 'recusada' && (
        <>
          <h1 className="text-2xl font-bold">Consulta mantida</h1>
          <p className="text-muted">
            Combinado, {data.patientFirstName}. Sua consulta continua em <b className="text-ink">{formatLong(data.currentScheduledAt)}</b>.
          </p>
          <p className="text-muted">Se abrir outro horário antes, avisamos você pelo WhatsApp.</p>
        </>
      )}

      {(data.status === 'expirada' || data.status === 'cancelada') && (
        <>
          <h1 className="text-2xl font-bold">Este horário não está mais disponível</h1>
          <p className="text-muted">O prazo para confirmar terminou e o horário foi oferecido a outro paciente da lista de espera.</p>
          <p className="text-muted">
            Sua consulta continua em <b className="text-ink">{formatLong(data.currentScheduledAt)}</b>, sem nenhuma alteração.
          </p>
        </>
      )}

      {actionError && (
        <p role="alert" className="rounded-xl bg-alert-soft px-4 py-3 text-sm text-alert-text">
          {actionError}
        </p>
      )}
    </Shell>
  );
}
