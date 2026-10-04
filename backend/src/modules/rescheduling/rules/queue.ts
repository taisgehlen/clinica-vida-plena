import type { Status } from '../../appointments/rules/status.js';

export const MIN_GAIN_HOURS = 24;
export const MIN_NOTICE_HOURS = 3;
export const DEFAULT_OFFER_TTL_MINUTES = 120;

const HOUR = 60 * 60 * 1000;

export type QueueAppointment = {
  id: string;
  patientId: string;
  patientPhone: string | null;
  doctorId: string;
  status: Status;
  bookedAt: Date;
  scheduledAt: Date;
};

export type Vacancy = { doctorId: string; scheduledAt: Date };

export type QueueContext = {
  alreadyOffered: ReadonlySet<string>;
  patientsWithOpenOffer: ReadonlySet<string>;
};

export type SkipReason = 'gain_too_small' | 'no_phone' | 'already_offered' | 'has_open_offer';

export type QueueEntry = { appointment: QueueAppointment; skip: SkipReason | null };

const ACTIVE: Status[] = ['agendada', 'confirmada'];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function skipReason(appointment: QueueAppointment, vacancy: Vacancy, context: QueueContext): SkipReason | null {
  if (appointment.scheduledAt.getTime() - vacancy.scheduledAt.getTime() < MIN_GAIN_HOURS * HOUR) return 'gain_too_small';
  if (!appointment.patientPhone) return 'no_phone';
  if (context.alreadyOffered.has(appointment.id)) return 'already_offered';
  if (context.patientsWithOpenOffer.has(appointment.patientId)) return 'has_open_offer';
  return null;
}

export function buildQueue(vacancy: Vacancy, appointments: QueueAppointment[], context: QueueContext): QueueEntry[] {
  return appointments
    .filter(
      (a) =>
        a.doctorId === vacancy.doctorId &&
        ACTIVE.includes(a.status) &&
        a.scheduledAt.getTime() > vacancy.scheduledAt.getTime(),
    )
    .sort(
      (x, y) =>
        startOfDay(y.scheduledAt) - startOfDay(x.scheduledAt) || x.bookedAt.getTime() - y.bookedAt.getTime(),
    )
    .map((appointment) => ({ appointment, skip: skipReason(appointment, vacancy, context) }));
}

export function nextInQueue(queue: QueueEntry[]): QueueAppointment | null {
  return queue.find((entry) => entry.skip === null)?.appointment ?? null;
}

export function canOffer(vacancyAt: Date, now: Date): boolean {
  return vacancyAt.getTime() - now.getTime() >= MIN_NOTICE_HOURS * HOUR;
}

export function offerExpiresAt(now: Date, vacancyAt: Date, ttlMinutes: number): Date {
  const byTtl = now.getTime() + ttlMinutes * 60 * 1000;
  const lastMoment = vacancyAt.getTime() - MIN_NOTICE_HOURS * HOUR;
  return new Date(Math.min(byTtl, lastMoment));
}