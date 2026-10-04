import type { Status } from '../appointments/rules/status.js';

export type IndicatorAppointment = {
  patientId: string;
  patientName: string;
  doctorId: string;
  serviceType: 'convenio' | 'particular';
  bookedAt: Date;
  scheduledAt: Date;
  status: Status;
  flags: string[];
};

export type IndicatorDoctor = { id: string; name: string; specialty: string };

export type Rate = {
  completed: number;
  noShows: number;
  noShowRate: number | null;
};

export type Indicators = {
  period: { from: string | null; to: string | null };
  summary: Rate & {
    total: number;
    patientCancellations: number;
    clinicCancellations: number;
    lostSlots: number;
    lostSlotRate: number | null;
    cancellationRate: number | null;
    pendingClosure: number;
    scheduled: number;
  };
  byDoctor: (Rate & { doctorId: string; name: string; specialty: string })[];
  byLeadTime: (Rate & { bucket: string })[];
  byWeekdayShift: (Rate & { weekday: string; shift: 'manha' | 'tarde' })[];
  byFirstVisit: (Rate & { group: 'primeira_consulta' | 'recorrente' })[];
  byServiceType: (Rate & { serviceType: 'convenio' | 'particular' })[];
  byMonth: (Rate & { month: string })[];
  repeatNoShowPatients: { patientId: string; name: string; noShows: number; appointments: number }[];
};

const CANCELLED: Status[] = ['cancelada_paciente', 'cancelada_clinica'];
const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const DAY_MS = 24 * 60 * 60 * 1000;
export const REPEAT_NO_SHOW_THRESHOLD = 3;

export const LEAD_TIME_BUCKETS = [
  { bucket: '0-3 dias', min: 0, max: 3 },
  { bucket: '4-7 dias', min: 4, max: 7 },
  { bucket: '8-14 dias', min: 8, max: 14 },
  { bucket: '15+ dias', min: 15, max: Infinity },
];

const round = (value: number) => Math.round(value * 1000) / 1000;
const ratio = (part: number, whole: number) => (whole === 0 ? null : round(part / whole));

function rateOf(items: IndicatorAppointment[]): Rate {
  const completed = items.filter((a) => a.status === 'realizada').length;
  const noShows = items.filter((a) => a.status === 'falta').length;
  return { completed, noShows, noShowRate: ratio(noShows, completed + noShows) };
}

function groupBy<K extends string>(items: IndicatorAppointment[], key: (a: IndicatorAppointment) => K) {
  const groups = new Map<K, IndicatorAppointment[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const slotKey = (a: IndicatorAppointment) => `${a.doctorId}|${a.scheduledAt.getTime()}`;

function leadTimeDays(a: IndicatorAppointment): number {
  const booked = new Date(a.bookedAt.getFullYear(), a.bookedAt.getMonth(), a.bookedAt.getDate());
  const scheduled = new Date(a.scheduledAt.getFullYear(), a.scheduledAt.getMonth(), a.scheduledAt.getDate());
  return Math.round((scheduled.getTime() - booked.getTime()) / DAY_MS);
}

export function computeIndicators(
  all: IndicatorAppointment[],
  doctors: IndicatorDoctor[],
  from: Date | null,
  to: Date | null,
  period: { from: string | null; to: string | null } = { from: null, to: null },
): Indicators {
  const firstVisit = new Map<string, number>();
  const activeSlots = new Set<string>();
  for (const a of all) {
    if (CANCELLED.includes(a.status)) continue;
    activeSlots.add(slotKey(a));
    const t = a.scheduledAt.getTime();
    if (t < (firstVisit.get(a.patientId) ?? Infinity)) firstVisit.set(a.patientId, t);
  }

  const inPeriod = all.filter(
    (a) => (!from || a.scheduledAt >= from) && (!to || a.scheduledAt <= to),
  );

 
  const rate = rateOf(inPeriod);
  const patientCancellations = inPeriod.filter((a) => a.status === 'cancelada_paciente');
  const clinicCancellations = inPeriod.filter((a) => a.status === 'cancelada_clinica').length;
  const notReused = patientCancellations.filter((a) => !activeSlots.has(slotKey(a))).length;
  const measured = rate.completed + rate.noShows;

  const byDoctorGroups = groupBy(inPeriod, (a) => a.doctorId);
  const byDoctor = doctors.map((d) => ({
    doctorId: d.id,
    name: d.name,
    specialty: d.specialty,
    ...rateOf(byDoctorGroups.get(d.id) ?? []),
  }));

  const byLeadTime = LEAD_TIME_BUCKETS.map(({ bucket, min, max }) => ({
    bucket,
    ...rateOf(inPeriod.filter((a) => leadTimeDays(a) >= min && leadTimeDays(a) <= max)),
  }));

  const byWeekdayShift = [...groupBy(inPeriod, (a) => `${a.scheduledAt.getDay()}|${a.scheduledAt.getHours() < 12 ? 'manha' : 'tarde'}`)]
    .map(([key, items]) => {
      const [day, shift] = key.split('|') as [string, 'manha' | 'tarde'];
      return { dayIndex: Number(day), weekday: WEEKDAYS[Number(day)]!, shift, ...rateOf(items) };
    })
    .filter((g) => g.completed + g.noShows > 0)
    .sort((x, y) => x.dayIndex - y.dayIndex || x.shift.localeCompare(y.shift))
    .map(({ dayIndex: _dayIndex, ...rest }) => rest);

  const isFirst = (a: IndicatorAppointment) => firstVisit.get(a.patientId) === a.scheduledAt.getTime();
  const byFirstVisit = [
    { group: 'primeira_consulta' as const, ...rateOf(inPeriod.filter(isFirst)) },
    { group: 'recorrente' as const, ...rateOf(inPeriod.filter((a) => !isFirst(a))) },
  ];

  const byServiceType = (['convenio', 'particular'] as const).map((serviceType) => ({
    serviceType,
    ...rateOf(inPeriod.filter((a) => a.serviceType === serviceType)),
  }));

  const byMonth = [...groupBy(inPeriod, (a) => monthKey(a.scheduledAt))]
    .map(([month, items]) => ({ month, ...rateOf(items) }))
    .filter((m) => m.completed + m.noShows > 0)
    .sort((x, y) => x.month.localeCompare(y.month));

  const repeatNoShowPatients = [...groupBy(inPeriod, (a) => a.patientId)]
    .map(([patientId, items]) => ({
      patientId,
      name: items[0]!.patientName,
      noShows: items.filter((a) => a.status === 'falta').length,
      appointments: items.filter((a) => !CANCELLED.includes(a.status)).length,
    }))
    .filter((p) => p.noShows >= REPEAT_NO_SHOW_THRESHOLD)
    .sort((x, y) => y.noShows - x.noShows || x.patientId.localeCompare(y.patientId));

  return {
    period,
    summary: {
      ...rate,
      total: inPeriod.length,
      patientCancellations: patientCancellations.length,
      clinicCancellations,
      lostSlots: rate.noShows + notReused,
      lostSlotRate: ratio(rate.noShows + notReused, measured + patientCancellations.length),
      cancellationRate: ratio(patientCancellations.length + clinicCancellations, inPeriod.length),
      pendingClosure: inPeriod.filter((a) => a.flags.includes('pendente_de_fechamento')).length,
      scheduled: inPeriod.filter((a) => a.status === 'agendada' || a.status === 'confirmada').length,
    },
    byDoctor,
    byLeadTime,
    byWeekdayShift,
    byFirstVisit,
    byServiceType,
    byMonth,
    repeatNoShowPatients,
  };
}