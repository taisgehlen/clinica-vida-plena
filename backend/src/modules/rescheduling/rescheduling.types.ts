import type { SkipReason } from './rules/queue.js';

export type ConfirmationStatus = 'pendente' | 'confirmada' | 'cancelou' | 'sem_resposta';

export type ConfirmationEventType =
  | 'request_sent'
  | 'reminder_sent'
  | 'confirmed'
  | 'confirmed_by_phone'
  | 'said_cannot_go'
  | 'kept_appointment'
  | 'cancelled_by_patient'
  | 'cancelled_by_reception'
  | 'no_answer';

export type TimelineEvent<T extends string> = { at: Date; type: T };

export type Confirmation = {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  scheduledAt: Date;
  status: ConfirmationStatus;
  awaitingCancelAnswer: boolean;
  tokenHash: string;
  sentAt: Date;
  reminderSentAt: Date | null;
  answeredAt: Date | null;
  events: TimelineEvent<ConfirmationEventType>[];
};

export type NewConfirmation = Omit<Confirmation, 'id'>;

export type VacancyStatus = 'aberta' | 'oferecida' | 'preenchida' | 'sem_fila' | 'em_cima_da_hora';

export type VacancyOrigin = { kind: 'cancelamento' | 'antecipacao'; appointmentId: string; patientName: string };

export type Vacancy = {
  id: string;
  doctorId: string;
  scheduledAt: Date;
  status: VacancyStatus;
  origin: VacancyOrigin;
  filledByAppointmentId: string | null;
  createdAt: Date;
};

export type NewVacancy = Omit<Vacancy, 'id'>;

export type OfferStatus = 'pendente' | 'aceita' | 'recusada' | 'expirada' | 'cancelada';

export type Offer = {
  id: string;
  vacancyId: string;
  appointmentId: string;
  patientId: string;
  previousScheduledAt: Date;
  status: OfferStatus;
  tokenHash: string;
  sentAt: Date;
  expiresAt: Date;
  answeredAt: Date | null;
};

export type NewOffer = Omit<Offer, 'id'>;

export type MessageKind =
  | 'confirmation_request'
  | 'confirmation_reminder'
  | 'confirmation_ask_cancel'
  | 'confirmation_confirmed'
  | 'confirmation_cancelled'
  | 'offer'
  | 'offer_accepted'
  | 'offer_kept'
  | 'offer_expired'
  | 'patient_reply';

export type ConfirmationAnswer = 'yes' | 'no' | 'cancel' | 'keep';

export type MessageButton = { label: string; answer: ConfirmationAnswer };

export type Message = {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  direction: 'out' | 'in';
  kind: MessageKind;
  body: string;
  buttons: MessageButton[];
  link: string | null;
  replyToken: string | null;
  confirmationId: string | null;
  offerId: string | null;
  sentAt: Date;
};

export type NewMessage = Omit<Message, 'id'>;

export interface ConfirmationRepository {
  create(data: NewConfirmation): Promise<Confirmation>;
  findById(id: string): Promise<Confirmation | null>;
  findByTokenHash(tokenHash: string): Promise<Confirmation | null>;
  findByAppointmentIds(appointmentIds: string[]): Promise<Confirmation[]>;
  findPending(): Promise<Confirmation[]>;
  findSince(since: Date): Promise<Confirmation[]>;
  update(id: string, changes: Partial<NewConfirmation>, newEvent: TimelineEvent<ConfirmationEventType>): Promise<Confirmation>;
}

export interface VacancyRepository {
  create(data: NewVacancy): Promise<Vacancy>;
  findById(id: string): Promise<Vacancy | null>;
  findFrom(from: Date): Promise<Vacancy[]>;
  changeStatus(id: string, from: VacancyStatus[], to: VacancyStatus, filledByAppointmentId?: string): Promise<Vacancy | null>;
}

export interface OfferRepository {
  create(data: NewOffer): Promise<Offer>;
  findById(id: string): Promise<Offer | null>;
  findByTokenHash(tokenHash: string): Promise<Offer | null>;
  findByVacancy(vacancyId: string): Promise<Offer[]>;
  findPending(): Promise<Offer[]>;
  findSince(since: Date): Promise<Offer[]>;
  findAccepted(): Promise<Offer[]>;
  closeIfPending(id: string, status: Exclude<OfferStatus, 'pendente'>, at: Date): Promise<Offer | null>;
}

export interface Outbox {
  send(message: NewMessage): Promise<Message>;
  findByPatient(patientId: string): Promise<Message[]>;
}

export type QueueView = {
  appointmentId: string;
  patientName: string;
  scheduledAt: Date;
  bookedAt: Date;
  skip: SkipReason | null;
};
