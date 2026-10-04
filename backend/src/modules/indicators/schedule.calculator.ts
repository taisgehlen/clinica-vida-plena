import type { Status } from '../appointments/rules/status.js';
import { SLOT_MINUTES, toMinutes, type ScheduleBlock } from '../appointments/rules/slots.js';

export type ScheduleAppointment = { doctorId: string; scheduledAt: Date; status: Status };
export type ScheduleDoctor = { id: string; schedule: ScheduleBlock[] };

export type DoctorSchedule = {
  doctorId: string;
  capacity: number;
  occupied: number;
  occupancyRate: number | null;
};

export type ScheduleIndicators = {
  capacity: number;
  occupied: number;
  free: number;
  occupancyRate: number | null;
  cancellations: { total: number; filled: number; unfilled: number };
  byDoctor: DoctorSchedule[];
};

const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const CANCELLED: Status[] = ['cancelada_paciente', 'cancelada_clinica'];

const round = (value: number) => Math.round(value * 1000) / 1000;
const ratio = (part: number, whole: number) => (whole === 0 ? null : round(part / whole));
const keyOf = (doctorId: string, at: Date) => `${doctorId}|${at.getTime()}`;

function gridSlots(doctor: ScheduleDoctor, start: Date, end: Date): Date[] {
  const slots: Date[] = [];
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (day <= end) {
    const weekday = WEEKDAYS[day.getDay()];
    for (const block of doctor.schedule.filter((b) => b.dia === weekday)) {
      for (let m = toMinutes(block.inicio); m + SLOT_MINUTES <= toMinutes(block.fim); m += SLOT_MINUTES) {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, m);
        if (slot >= start && slot <= end) slots.push(slot);
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return slots;
}

export function computeSchedule(
  all: ScheduleAppointment[],
  doctors: ScheduleDoctor[],
  from: Date | null,
  to: Date | null,
  now: Date,
): ScheduleIndicators {
  const inPeriod = all.filter((a) => (!from || a.scheduledAt >= from) && (!to || a.scheduledAt <= to));

  const firstAppointment = all.reduce<Date | null>(
    (first, a) => (!first || a.scheduledAt < first ? a.scheduledAt : first),
    null,
  );
  const start = from ?? firstAppointment;
  const end = to && to < now ? to : now;

  const activeKeys = new Set(all.filter((a) => !CANCELLED.includes(a.status)).map((a) => keyOf(a.doctorId, a.scheduledAt)));

  const byDoctor = doctors.map((doctor) => {
    const slots = start ? gridSlots(doctor, start, end) : [];
    const occupied = slots.filter((slot) => activeKeys.has(keyOf(doctor.id, slot))).length;
    return { doctorId: doctor.id, capacity: slots.length, occupied, occupancyRate: ratio(occupied, slots.length) };
  });

  const capacity = byDoctor.reduce((sum, d) => sum + d.capacity, 0);
  const occupied = byDoctor.reduce((sum, d) => sum + d.occupied, 0);

  const cancelled = inPeriod.filter((a) => CANCELLED.includes(a.status));
  const filled = cancelled.filter((a) => activeKeys.has(keyOf(a.doctorId, a.scheduledAt))).length;

  return {
    capacity,
    occupied,
    free: capacity - occupied,
    occupancyRate: ratio(occupied, capacity),
    cancellations: { total: cancelled.length, filled, unfilled: cancelled.length - filled },
    byDoctor,
  };
}