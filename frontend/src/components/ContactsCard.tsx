import { useState } from 'react';
import type { Contact } from '../api/rescheduling';
import { useNow } from '../hooks/useNow';
import { formatDayTime, formatEventMoment, formatRemaining } from '../utils/datetime';
import { confirmationStatus, offerStatus, TIMELINE_LABELS } from '../utils/rescheduling';
import { Card } from './Card';
import { StatusPill } from './StatusPill';

type Props = { contacts: Contact[]; onOpenConversation: (contact: Contact) => void; className?: string };

function ContactStatus({ contact, now }: { contact: Contact; now: number }) {
  const current = contact.current;
  if (current.kind === 'confirmation') {
    const { label, tone } = confirmationStatus(current.status, current.reminderSent);
    return <StatusPill tone={tone}>{label}</StatusPill>;
  }
  if (current.status === 'pendente') return <StatusPill tone="teal">Responde em {formatRemaining(current.expiresAt, now)}</StatusPill>;
  const { label, tone } = offerStatus(current.status);
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

type Filter = 'all' | 'confirmation' | 'offer';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'confirmation', label: 'Confirmação' },
  { id: 'offer', label: 'Antecipação' },
];

export function ContactsCard({ contacts, onOpenConversation, className }: Props) {
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = filter === 'all' ? contacts : contacts.filter((c) => c.current.kind === filter);
  return (
    <Card
      title="Mensagens enviadas"
      description="Selecione um paciente para visualizar a conversa."
      badge={<span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-bold text-warn-text">WhatsApp simulado</span>}
      className={className}
    >
      <div role="group" aria-label="Filtrar por tipo de mensagem" className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-muted aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
          >
            {item.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 rounded-lg bg-inner px-4 py-3 text-sm text-muted">Ninguém contatado nos últimos 7 dias.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {shown.map((contact) => {
            const noAnswer = contact.current.status === 'sem_resposta';
            const isConfirmation = contact.current.kind === 'confirmation';
            const label = isConfirmation ? 'Consulta' : 'Novo horário';
            return (
              <li
                key={contact.patientId}
                className={`rounded-xl border border-l-4 p-3 ${noAnswer ? 'border-alert/50' : 'border-line'} ${isConfirmation ? 'border-l-brand' : 'border-l-teal'}`}
              >
                <p className={`text-[10px] font-extrabold tracking-wide uppercase ${isConfirmation ? 'text-brand' : 'text-teal'}`}>
                  {isConfirmation ? 'Confirmação de presença' : 'Convite para antecipar'}
                </p>
                <p className="text-sm font-bold">{contact.patientName}</p>
                <p className="text-xs text-faint">
                  {label}: {formatDayTime(contact.current.scheduledAt)} · {contact.current.doctorName}
                </p>
                <div className="mt-1.5">
                  <ContactStatus contact={contact} now={now} />
                </div>
                <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 text-xs text-muted">
                  {contact.timeline.map((event, index) => (
                    <li key={`${event.type}-${event.at}`} className="relative">
                      <span
                        aria-hidden="true"
                        className={`absolute top-1 -left-[17px] size-2 rounded-full ${index === contact.timeline.length - 1 ? 'bg-brand' : 'bg-line'}`}
                      />
                      <b className="font-semibold text-ink">{formatEventMoment(event.at, new Date(now))}</b> {TIMELINE_LABELS[event.type]}
                    </li>
                  ))}
                </ol>
                {noAnswer && (
                  <p className="mt-2 rounded-lg bg-alert-soft px-2.5 py-1.5 text-xs font-semibold text-alert-text">
                    Não respondeu às 2 mensagens. Ligue para {contact.phone} e registre a resposta em “Próximas consultas”.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onOpenConversation(contact)}
                  aria-label={`Simular paciente: ${contact.patientName}`}
                  className="mt-2 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-inner"
                >
                  Simular paciente ↗
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}