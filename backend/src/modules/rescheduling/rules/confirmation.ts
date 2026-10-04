import type { Status } from '../../appointments/rules/status.js';

export const RISK_LEAD_DAYS = 15;
export const CONFIRM_DAYS_BEFORE = 2;
export const REMINDER_HOURS_BEFORE = 24;
export const CALL_HOURS_BEFORE = 12;
export const MIN_HOURS_BETWEEN_MESSAGES = 6;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type ConfirmationCandidate = {
  status: Status;
  patientPhone: string | null;
  bookedAt: Date;
  scheduledAt: Date;
};

export type PendingConfirmation = {
  scheduledAt: Date;
  sentAt: Date;
  reminderSentAt: Date | null;
  awaitingCancelAnswer?: boolean;
};

export type ConfirmationStep = 'wait' | 'send_reminder' | 'mark_no_answer';

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function leadTimeDays(bookedAt: Date, scheduledAt: Date): number {
  return Math.floor((startOfDay(scheduledAt) - startOfDay(bookedAt)) / DAY);
}

export function isHighRisk(appointment: Pick<ConfirmationCandidate, 'bookedAt' | 'scheduledAt'>): boolean {
  return leadTimeDays(appointment.bookedAt, appointment.scheduledAt) >= RISK_LEAD_DAYS;
}

export function confirmationSendDate(scheduledAt: Date): Date {
  const day = new Date(startOfDay(scheduledAt));
  day.setDate(day.getDate() - CONFIRM_DAYS_BEFORE);
  return day;
}

export function needsConfirmation(appointment: ConfirmationCandidate, now: Date): boolean {
  if (appointment.status !== 'agendada') return false;
  if (!appointment.patientPhone) return false;
  if (!isHighRisk(appointment)) return false;
  if (appointment.scheduledAt.getTime() - now.getTime() <= CALL_HOURS_BEFORE * HOUR) return false;
  return now.getTime() >= confirmationSendDate(appointment.scheduledAt).getTime();
}

export function nextConfirmationStep(confirmation: PendingConfirmation, now: Date): ConfirmationStep {
  const untilAppointment = confirmation.scheduledAt.getTime() - now.getTime();
  if (untilAppointment <= CALL_HOURS_BEFORE * HOUR) return 'mark_no_answer';
  if (confirmation.awaitingCancelAnswer) return 'wait';

  const reminderDue = untilAppointment <= REMINDER_HOURS_BEFORE * HOUR;
  const enoughTimeSinceFirst = now.getTime() - confirmation.sentAt.getTime() >= MIN_HOURS_BETWEEN_MESSAGES * HOUR;
  if (!confirmation.reminderSentAt && reminderDue && enoughTimeSinceFirst) return 'send_reminder';

  return 'wait';
}