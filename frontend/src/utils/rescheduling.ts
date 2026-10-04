import type { ConfirmationStatus, Contact, OfferStatus, SkipReason, TimelineType, VacancyItem } from '../api/rescheduling';

export type Tone = 'info' | 'good' | 'neutral' | 'alert' | 'warn' | 'teal';

export const TIMELINE_LABELS: Record<TimelineType, string> = {
  request_sent: 'Pedido de confirmação enviado',
  reminder_sent: '2º lembrete enviado',
  confirmed: 'Confirmou presença',
  confirmed_by_phone: 'Confirmou por telefone (recepção)',
  said_cannot_go: 'Avisou que não poderá ir',
  kept_appointment: 'Decidiu manter a consulta',
  cancelled_by_patient: 'Cancelou pelo WhatsApp: vaga aberta',
  cancelled_by_reception: 'Cancelamento registrado pela recepção',
  no_answer: 'Não respondeu às 2 mensagens',
  offer_sent: 'Convite para antecipar enviado',
  offer_accepted: 'Aceitou a antecipação',
  offer_declined: 'Preferiu manter a data',
  offer_expired: 'Não respondeu a tempo',
  offer_cancelled: 'Convite cancelado pela recepção',
};

export const SKIP_LABELS: Record<SkipReason, string> = {
  gain_too_small: 'ganha menos de 1 dia',
  no_phone: 'sem telefone para contato',
  already_offered: 'já recebeu o convite',
  has_open_offer: 'tem outro convite aberto',
};

const CONFIRMATION_STATUS: Record<ConfirmationStatus, { label: string; tone: Tone }> = {
  pendente: { label: 'Aguardando resposta', tone: 'info' },
  confirmada: { label: 'Presença confirmada', tone: 'good' },
  cancelou: { label: 'Cancelou: vaga aberta', tone: 'neutral' },
  sem_resposta: { label: 'Sem resposta · ligar', tone: 'alert' },
};

export function confirmationStatus(status: ConfirmationStatus, reminderSent: boolean): { label: string; tone: Tone } {
  if (status === 'pendente' && reminderSent) return { label: 'Aguardando · 2º lembrete', tone: 'info' };
  return CONFIRMATION_STATUS[status];
}

const OFFER_STATUS: Record<Exclude<OfferStatus, 'pendente'>, { label: string; tone: Tone }> = {
  aceita: { label: 'Antecipou', tone: 'good' },
  recusada: { label: 'Manteve a consulta', tone: 'neutral' },
  expirada: { label: 'Não respondeu', tone: 'alert' },
  cancelada: { label: 'Convite cancelado', tone: 'neutral' },
};

export function offerStatus(status: Exclude<OfferStatus, 'pendente'>): { label: string; tone: Tone } {
  return OFFER_STATUS[status];
}

export function contactRank(contact: Contact): number {
  if (contact.current.status === 'sem_resposta') return 2;
  return contact.needsAttention ? 1 : 0;
}

export function vacancyOrigin(vacancy: VacancyItem): string {
  const who = vacancy.origin.patientName;
  return vacancy.origin.kind === 'cancelamento' ? `Abriu porque ${who} cancelou` : `Abriu porque ${who} antecipou a consulta`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
