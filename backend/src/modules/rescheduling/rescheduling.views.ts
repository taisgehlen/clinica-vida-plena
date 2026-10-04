import type { Appointment } from '../appointments/appointment.types.js';
import type { Doctor } from '../doctors/doctor.types.js';
import type {
  Confirmation,
  ConfirmationEventType,
  ConfirmationStatus,
  MessageButton,
  MessageKind,
  Offer,
  OfferStatus,
  VacancyOrigin,
  VacancyStatus,
} from './rescheduling.types.js';
import type { ReschedulingDependencies, ReschedulingService } from './rescheduling.service.js';
import { confirmationSendDate, isHighRisk, leadTimeDays } from './rules/confirmation.js';
import type { SkipReason } from './rules/queue.js';

const DAY = 24 * 60 * 60 * 1000;
const CONTACT_HISTORY_DAYS = 7;
const UPCOMING_DAYS = 60;

type OfferEventType = 'offer_sent' | 'offer_accepted' | 'offer_declined' | 'offer_expired' | 'offer_cancelled';

export type ContactView = {
  patientId: string;
  patientName: string;
  phone: string;
  needsAttention: boolean;
  current:
    | { kind: 'confirmation'; status: ConfirmationStatus; confirmationId: string; reminderSent: boolean; scheduledAt: Date; doctorName: string }
    | { kind: 'offer'; status: OfferStatus; offerId: string; expiresAt: Date; scheduledAt: Date; doctorName: string };
  timeline: { at: Date; type: ConfirmationEventType | OfferEventType }[];
};

export type VacancyView = {
  id: string;
  doctorName: string;
  scheduledAt: Date;
  status: VacancyStatus;
  origin: VacancyOrigin;
  pendingOffer: { offerId: string; patientName: string; expiresAt: Date } | null;
  filledBy: string | null;
  queue: { appointmentId: string; patientName: string; scheduledAt: Date; bookedAt: Date; gainDays: number; skip: SkipReason | null }[];
};

export type OverviewView = {
  summary: { awaitingConfirmation: number; noAnswer: number; confirmed: number; openVacancies: number; anticipatedThisMonth: number };
  vacancies: VacancyView[];
  contacts: ContactView[];
};

export type UpcomingFilter = 'all' | 'waiting' | 'no_answer';

export type UpcomingView = {
  appointmentId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  scheduledAt: Date;
  status: Appointment['status'];
  leadDays: number;
  highRisk: boolean;
  anticipated: boolean;
  confirmation: { id: string; status: ConfirmationStatus; reminderSent: boolean } | null;
  confirmationRequestDate: Date | null;
};

export type ConversationView = {
  patientName: string;
  phone: string;
  messages: {
    id: string;
    direction: 'in' | 'out';
    kind: MessageKind;
    body: string;
    sentAt: Date;
    link: string | null;
    replyToken: string | null;
    buttons: MessageButton[];
  }[];
};

export function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 6) return '';
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 3)}****-${phone.slice(-4)}`;
}

function offerTimeline(offer: Offer): ContactView['timeline'] {
  const events: ContactView['timeline'] = [{ at: offer.sentAt, type: 'offer_sent' }];
  const closing: Record<Exclude<OfferStatus, 'pendente'>, OfferEventType> = {
    aceita: 'offer_accepted',
    recusada: 'offer_declined',
    expirada: 'offer_expired',
    cancelada: 'offer_cancelled',
  };
  if (offer.status !== 'pendente') events.push({ at: offer.answeredAt ?? offer.expiresAt, type: closing[offer.status] });
  return events;
}

const lastAt = (timeline: ContactView['timeline']) => Math.max(...timeline.map((e) => e.at.getTime()));

export class ReschedulingViews {
  constructor(
    private readonly deps: ReschedulingDependencies,
    private readonly service: ReschedulingService,
  ) {}

  private async doctorNames(): Promise<Map<string, Doctor>> {
    return new Map((await this.deps.doctors.findAll()).map((d) => [d.id, d]));
  }

  async overview(): Promise<OverviewView> {
    const now = this.deps.now();
    const since = new Date(now.getTime() - CONTACT_HISTORY_DAYS * DAY);
    const [doctors, vacancies, confirmations, offers, accepted, pendingConfirmations] = await Promise.all([
      this.doctorNames(),
      this.deps.vacancies.findFrom(now),
      this.deps.confirmations.findSince(since),
      this.deps.offers.findSince(since),
      this.deps.offers.findAccepted(),
      this.deps.confirmations.findPending(),
    ]);

    const appointmentIds = new Set([
      ...confirmations.map((c) => c.appointmentId),
      ...offers.map((o) => o.appointmentId),
      ...vacancies.map((v) => v.filledByAppointmentId).filter((id): id is string => id !== null),
    ]);
    const appointments = new Map((await this.deps.appointments.findByIds([...appointmentIds])).map((a) => [a.id, a]));
    const doctorName = (id: string) => doctors.get(id)?.name ?? id;

    const vacancyViews: VacancyView[] = [];
    for (const vacancy of [...vacancies].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
      const queue = await this.service.queueFor(vacancy);
      const pending = offers.find((o) => o.vacancyId === vacancy.id && o.status === 'pendente');
      vacancyViews.push({
        id: vacancy.id,
        doctorName: doctorName(vacancy.doctorId),
        scheduledAt: vacancy.scheduledAt,
        status: vacancy.status,
        origin: vacancy.origin,
        pendingOffer: pending
          ? { offerId: pending.id, patientName: appointments.get(pending.appointmentId)?.patientName ?? '', expiresAt: pending.expiresAt }
          : null,
        filledBy: vacancy.filledByAppointmentId ? (appointments.get(vacancy.filledByAppointmentId)?.patientName ?? null) : null,
        queue: queue.map(({ appointment, skip }) => ({
          appointmentId: appointment.id,
          patientName: appointment.patientName,
          scheduledAt: appointment.scheduledAt,
          bookedAt: appointment.bookedAt,
          gainDays: Math.round((appointment.scheduledAt.getTime() - vacancy.scheduledAt.getTime()) / DAY),
          skip,
        })),
      });
    }

    const contacts = new Map<string, ContactView>();
    const upsert = (appointment: Appointment, candidate: ContactView['current'], timeline: ContactView['timeline']) => {
      const existing = contacts.get(appointment.patientId);
      const merged = [...(existing?.timeline ?? []), ...timeline].sort((a, b) => a.at.getTime() - b.at.getTime());
      const isNewer = !existing || lastAt(timeline) >= lastAt(existing.timeline);
      const current = isNewer ? candidate : existing.current;
      contacts.set(appointment.patientId, {
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        phone: maskPhone(appointment.patientPhone),
        needsAttention: current.status === 'pendente' || current.status === 'sem_resposta',
        current,
        timeline: merged,
      });
    };
    for (const c of confirmations) {
      const appointment = appointments.get(c.appointmentId);
      if (!appointment) continue;
      upsert(
        appointment,
        { kind: 'confirmation', status: c.status, confirmationId: c.id, reminderSent: c.reminderSentAt !== null, scheduledAt: c.scheduledAt, doctorName: doctorName(c.doctorId) },
        c.events,
      );
    }
    for (const o of offers) {
      const appointment = appointments.get(o.appointmentId);
      const vacancy = vacancies.find((v) => v.id === o.vacancyId);
      if (!appointment) continue;
      upsert(
        appointment,
        { kind: 'offer', status: o.status, offerId: o.id, expiresAt: o.expiresAt, scheduledAt: vacancy?.scheduledAt ?? o.previousScheduledAt, doctorName: doctorName(appointment.doctorId) },
        offerTimeline(o),
      );
    }

    const rank = (c: ContactView) => (c.current.status === 'sem_resposta' ? 2 : c.needsAttention ? 1 : 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      summary: {
        awaitingConfirmation: pendingConfirmations.length,
        noAnswer: confirmations.filter((c) => c.status === 'sem_resposta').length,
        confirmed: confirmations.filter((c) => c.status === 'confirmada').length,
        openVacancies: vacancies.filter((v) => v.status !== 'preenchida').length,
        anticipatedThisMonth: accepted.filter((o) => (o.answeredAt ?? o.sentAt).getTime() >= monthStart.getTime()).length,
      },
      vacancies: vacancyViews,
      contacts: [...contacts.values()].sort((a, b) => rank(b) - rank(a) || lastAt(b.timeline) - lastAt(a.timeline)),
    };
  }

  async upcoming(filter: { doctorId?: string | undefined; search?: string | undefined; situation: UpcomingFilter }): Promise<UpcomingView[]> {
    const now = this.deps.now();
    const until = now.getTime() + UPCOMING_DAYS * DAY;
    const [doctors, appointments, accepted] = await Promise.all([
      this.doctorNames(),
      this.deps.appointments.findActiveFrom(now),
      this.deps.offers.findAccepted(),
    ]);
    const search = filter.search?.trim().toLocaleLowerCase('pt-BR');
    const inRange = appointments.filter(
      (a) =>
        a.scheduledAt.getTime() <= until &&
        (!filter.doctorId || a.doctorId === filter.doctorId) &&
        (!search || a.patientName.toLocaleLowerCase('pt-BR').includes(search)),
    );
    const confirmations = new Map(
      (await this.deps.confirmations.findByAppointmentIds(inRange.map((a) => a.id))).map((c): [string, Confirmation] => [c.appointmentId, c]),
    );
    const anticipated = new Set(accepted.map((o) => o.appointmentId));

    return inRange
      .map((a) => {
        const c = confirmations.get(a.id);
        const wasAnticipated = anticipated.has(a.id);
        const highRisk = isHighRisk(a) && !wasAnticipated;
        return {
          appointmentId: a.id,
          patientName: a.patientName,
          doctorId: a.doctorId,
          doctorName: doctors.get(a.doctorId)?.name ?? a.doctorId,
          scheduledAt: a.scheduledAt,
          status: a.status,
          leadDays: leadTimeDays(a.bookedAt, a.scheduledAt),
          highRisk,
          anticipated: wasAnticipated,
          confirmation: c ? { id: c.id, status: c.status, reminderSent: c.reminderSentAt !== null } : null,
          confirmationRequestDate: highRisk && !c && a.patientPhone ? confirmationSendDate(a.scheduledAt) : null,
        };
      })
      .filter((row) => {
        if (filter.situation === 'waiting') return row.confirmation?.status === 'pendente';
        if (filter.situation === 'no_answer') return row.confirmation?.status === 'sem_resposta';
        return true;
      });
  }

  async conversation(patientId: string): Promise<ConversationView | null> {
    const history = (await this.deps.outbox.findByPatient(patientId)).sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    const first = history[0];
    if (!first) return null;

    const confirmationIds = [...new Set(history.map((m) => m.confirmationId).filter((id): id is string => id !== null))];
    const confirmations = new Map<string, Confirmation>();
    for (const id of confirmationIds) {
      const c = await this.deps.confirmations.findById(id);
      if (c) confirmations.set(id, c);
    }
    const lastWithButtons = new Map<string, string>();
    for (const m of history) if (m.confirmationId && m.buttons.length > 0) lastWithButtons.set(m.confirmationId, m.id);

    return {
      patientName: first.patientName,
      phone: maskPhone(first.phone),
      messages: history.map((m) => {
        const c = m.confirmationId ? confirmations.get(m.confirmationId) : undefined;
        const open = c !== undefined && (c.status === 'pendente' || c.status === 'sem_resposta');
        const active = open && lastWithButtons.get(m.confirmationId ?? '') === m.id;
        return {
          id: m.id,
          direction: m.direction,
          kind: m.kind,
          body: m.body,
          sentAt: m.sentAt,
          link: m.link,
          replyToken: active ? m.replyToken : null,
          buttons: active ? m.buttons : [],
        };
      }),
    };
  }
}
