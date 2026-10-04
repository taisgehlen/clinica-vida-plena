import { apiGet, apiPatch, apiPost } from './client';

export type ConfirmationStatus = 'pendente' | 'confirmada' | 'cancelou' | 'sem_resposta';
export type OfferStatus = 'pendente' | 'aceita' | 'recusada' | 'expirada' | 'cancelada';
export type VacancyStatus = 'aberta' | 'oferecida' | 'preenchida' | 'sem_fila' | 'em_cima_da_hora';
export type SkipReason = 'gain_too_small' | 'no_phone' | 'already_offered' | 'has_open_offer';
export type TimelineType =
  | 'request_sent'
  | 'reminder_sent'
  | 'confirmed'
  | 'confirmed_by_phone'
  | 'said_cannot_go'
  | 'kept_appointment'
  | 'cancelled_by_patient'
  | 'cancelled_by_reception'
  | 'no_answer'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_declined'
  | 'offer_expired'
  | 'offer_cancelled';

export type Contact = {
  patientId: string;
  patientName: string;
  phone: string;
  needsAttention: boolean;
  current:
    | { kind: 'confirmation'; status: ConfirmationStatus; confirmationId: string; reminderSent: boolean; scheduledAt: string; doctorName: string }
    | { kind: 'offer'; status: OfferStatus; offerId: string; expiresAt: string; scheduledAt: string; doctorName: string };
  timeline: { at: string; type: TimelineType }[];
};

export type QueueEntry = {
  appointmentId: string;
  patientName: string;
  scheduledAt: string;
  bookedAt: string;
  gainDays: number;
  skip: SkipReason | null;
};

export type VacancyItem = {
  id: string;
  doctorName: string;
  scheduledAt: string;
  status: VacancyStatus;
  origin: { kind: 'cancelamento' | 'antecipacao'; appointmentId: string; patientName: string };
  pendingOffer: { offerId: string; patientName: string; expiresAt: string } | null;
  filledBy: string | null;
  queue: QueueEntry[];
};

export type Overview = {
  summary: {
    awaitingConfirmation: number;
    noAnswer: number;
    confirmed: number;
    declined: number;
    openVacancies: number;
    anticipatedThisMonth: number;
    daysGainedThisMonth: number;
  };
  vacancies: VacancyItem[];
  contacts: Contact[];
};

export type Situation = 'all' | 'waiting' | 'no_answer';

export type UpcomingAppointment = {
  appointmentId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  scheduledAt: string;
  status: string;
  leadDays: number;
  highRisk: boolean;
  anticipated: boolean;
  confirmation: { id: string; status: ConfirmationStatus; reminderSent: boolean } | null;
  confirmationRequestDate: string | null;
};

export type UpcomingFilters = { doctorId: string; search: string; situation: Situation };

export type ConfirmationAnswer = 'yes' | 'no' | 'cancel' | 'keep';

export type ConversationMessage = {
  id: string;
  direction: 'in' | 'out';
  kind: string;
  body: string;
  sentAt: string;
  link: string | null;
  replyToken: string | null;
  buttons: { label: string; answer: ConfirmationAnswer }[];
};

export type Conversation = { patientName: string; phone: string; messages: ConversationMessage[] };

export type Doctor = { id: string; name: string; specialty: string };

export function getOverview(signal: AbortSignal): Promise<Overview> {
  return apiGet<Overview>('/api/rescheduling/overview', { signal });
}

export function getUpcoming(filters: UpcomingFilters, signal: AbortSignal): Promise<UpcomingAppointment[]> {
  return apiGet<UpcomingAppointment[]>('/api/rescheduling/upcoming', {
    params: { doctorId: filters.doctorId || undefined, search: filters.search.trim() || undefined, situation: filters.situation },
    signal,
  });
}

export function getDoctors(signal: AbortSignal): Promise<Doctor[]> {
  return apiGet<Doctor[]>('/api/doctors', { signal });
}

export function getConversation(patientId: string, signal: AbortSignal): Promise<Conversation> {
  return apiGet<Conversation>(`/api/rescheduling/conversations/${encodeURIComponent(patientId)}`, { signal });
}

export function confirmByPhone(confirmationId: string): Promise<unknown> {
  return apiPost(`/api/rescheduling/confirmations/${encodeURIComponent(confirmationId)}/confirm-by-phone`);
}

export function cancelOffer(offerId: string): Promise<unknown> {
  return apiPost(`/api/rescheduling/offers/${encodeURIComponent(offerId)}/cancel`);
}

export function cancelAppointment(appointmentId: string, status: 'cancelada_paciente' | 'cancelada_clinica'): Promise<unknown> {
  return apiPatch(`/api/appointments/${encodeURIComponent(appointmentId)}/status`, { status });
}

export function answerConfirmation(token: string, answer: ConfirmationAnswer): Promise<unknown> {
  return apiPost(`/api/patient/confirmations/${encodeURIComponent(token)}`, { answer });
}

export type Anticipation = {
  status: OfferStatus;
  patientFirstName: string;
  doctorName: string;
  specialty: string;
  newScheduledAt: string;
  currentScheduledAt: string;
  expiresAt: string;
  gainDays: number;
};

export function getAnticipation(token: string, signal: AbortSignal): Promise<Anticipation> {
  return apiGet<Anticipation>(`/api/patient/offers/${encodeURIComponent(token)}`, { signal });
}

export function acceptAnticipation(token: string): Promise<Anticipation> {
  return apiPost<Anticipation>(`/api/patient/offers/${encodeURIComponent(token)}/accept`);
}

export function declineAnticipation(token: string): Promise<Anticipation> {
  return apiPost<Anticipation>(`/api/patient/offers/${encodeURIComponent(token)}/decline`);
}
