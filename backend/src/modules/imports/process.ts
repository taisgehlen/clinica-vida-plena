import type { Status } from '../appointments/rules/status.js';
import { validateSlot, type ScheduleBlock } from '../appointments/rules/slots.js';
import {
  normalizePhone,
  normalizeServiceType,
  normalizeStatus,
  parseDateTime,
  type ServiceType,
} from './normalize.js';

export type RawAppointmentRow = {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  paciente_telefone: string;
  tipo_atendimento: string;
  medico_id: string;
  data_agendamento: string;
  data_consulta: string;
  status: string;
};

export type Doctor = {
  id: string;
  nome: string;
  especialidade: string;
  grade: ScheduleBlock[];
};

export type AppointmentFlag =
  | 'fora_da_grade'
  | 'conflito_de_horario'
  | 'pendente_de_fechamento'
  | 'cancelamento_assumido_paciente';

export type CleanAppointment = {
  legacyId: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  serviceType: ServiceType;
  doctorId: string;
  bookedAt: Date;
  scheduledAt: Date;
  status: Status;
  cancelledAt: null;
  flags: AppointmentFlag[];
};

export type DiscardReason =
  | 'duplicata_exata'
  | 'id_conflitante'
  | 'status_invalido'
  | 'tipo_invalido'
  | 'data_invalida'
  | 'medico_desconhecido'
  | 'agendamento_apos_consulta'
  | 'status_final_no_futuro';

export type CorrectionKind =
  | 'status_padronizado'
  | 'tipo_padronizado'
  | 'data_formato_brasileiro'
  | 'telefone_padronizado'
  | 'telefone_invalido_removido'
  | 'nome_unificado';

export type ReportDetail = {
  line: number;
  id: string;
  action: 'descartado' | 'aviso';
  reason: DiscardReason | AppointmentFlag;
};

export type ImportReport = {
  referenceDate: Date;
  totalRows: number;
  imported: number;
  discarded: Partial<Record<DiscardReason, number>>;
  corrected: Partial<Record<CorrectionKind, number>>;
  warnings: Partial<Record<AppointmentFlag, number>>;
  details: ReportDetail[];
};

const CANCELLED: Status[] = ['cancelada_paciente', 'cancelada_clinica'];
const OPEN: Status[] = ['agendada', 'confirmada'];
const NEEDS_PAST: Status[] = ['realizada', 'falta'];

function increment<K extends string>(counter: Partial<Record<K, number>>, key: K): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

export function inferReferenceDate(rows: RawAppointmentRow[]): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    const parsed = parseDateTime(row.data_agendamento);
    if (parsed && (!latest || parsed.date > latest)) latest = parsed.date;
  }
  return latest;
}

export function processAppointments(
  rows: RawAppointmentRow[],
  doctors: Doctor[],
  referenceDate: Date,
): { appointments: CleanAppointment[]; report: ImportReport } {
  const report: ImportReport = {
    referenceDate,
    totalRows: rows.length,
    imported: 0,
    discarded: {},
    corrected: {},
    warnings: {},
    details: [],
  };
  const discard = (line: number, id: string, reason: DiscardReason) => {
    increment(report.discarded, reason);
    report.details.push({ line, id, action: 'descartado', reason });
  };

  const indexed = rows.map((row, i) => ({ row, line: i + 2 }));

  const seen = new Set<string>();
  const unique = indexed.filter(({ row, line }) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      discard(line, row.id, 'duplicata_exata');
      return false;
    }
    seen.add(key);
    return true;
  });

  const countById = new Map<string, number>();
  for (const { row } of unique) countById.set(row.id, (countById.get(row.id) ?? 0) + 1);
  const withoutConflicts = unique.filter(({ row, line }) => {
    if ((countById.get(row.id) ?? 0) > 1) {
      discard(line, row.id, 'id_conflitante');
      return false;
    }
    return true;
  });

  const doctorsById = new Map(doctors.map((d) => [d.id, d]));
  const valid: { appointment: CleanAppointment; line: number }[] = [];

  for (const { row, line } of withoutConflicts) {
    const status = normalizeStatus(row.status);
    if (!status) { discard(line, row.id, 'status_invalido'); continue; }

    const serviceType = normalizeServiceType(row.tipo_atendimento);
    if (!serviceType) { discard(line, row.id, 'tipo_invalido'); continue; }

    const booked = parseDateTime(row.data_agendamento);
    const scheduled = parseDateTime(row.data_consulta);
    if (!booked || !scheduled) { discard(line, row.id, 'data_invalida'); continue; }

    const doctor = doctorsById.get(row.medico_id.trim());
    if (!doctor) { discard(line, row.id, 'medico_desconhecido'); continue; }

    if (booked.date > scheduled.date) { discard(line, row.id, 'agendamento_apos_consulta'); continue; }

    if (NEEDS_PAST.includes(status.status) && scheduled.date > referenceDate) {
      discard(line, row.id, 'status_final_no_futuro');
      continue;
    }

    if (row.status.trim() !== status.status) increment(report.corrected, 'status_padronizado');
    if (row.tipo_atendimento.trim() !== serviceType) increment(report.corrected, 'tipo_padronizado');
    if (booked.format === 'br' || scheduled.format === 'br') increment(report.corrected, 'data_formato_brasileiro');

    const phone = normalizePhone(row.paciente_telefone);
    if (phone === null && row.paciente_telefone?.trim()) increment(report.corrected, 'telefone_invalido_removido');
    else if (phone !== null && phone !== row.paciente_telefone.trim()) increment(report.corrected, 'telefone_padronizado');

    const flags: AppointmentFlag[] = [];
    if (status.assumedPatientCancellation) flags.push('cancelamento_assumido_paciente');
    if (!validateSlot(doctor.grade, scheduled.date).ok) flags.push('fora_da_grade');
    if (OPEN.includes(status.status) && scheduled.date < referenceDate) flags.push('pendente_de_fechamento');

    valid.push({
      line,
      appointment: {
        legacyId: row.id.trim(),
        patientId: row.paciente_id.trim(),
        patientName: row.paciente_nome.trim(),
        patientPhone: phone,
        serviceType,
        doctorId: doctor.id,
        bookedAt: booked.date,
        scheduledAt: scheduled.date,
        status: status.status,
        cancelledAt: null,
        flags,
      },
    });
  }

  const slotCount = new Map<string, number>();
  const slotKey = (a: CleanAppointment) => `${a.doctorId}|${a.scheduledAt.getTime()}`;
  for (const { appointment } of valid) {
    if (!CANCELLED.includes(appointment.status)) {
      slotCount.set(slotKey(appointment), (slotCount.get(slotKey(appointment)) ?? 0) + 1);
    }
  }
  for (const { appointment } of valid) {
    if (!CANCELLED.includes(appointment.status) && (slotCount.get(slotKey(appointment)) ?? 0) > 1) {
      appointment.flags.push('conflito_de_horario');
    }
  }

  const namesByPatient = new Map<string, Map<string, number>>();
  for (const { appointment: a } of valid) {
    const names = namesByPatient.get(a.patientId) ?? new Map<string, number>();
    names.set(a.patientName, (names.get(a.patientName) ?? 0) + 1);
    namesByPatient.set(a.patientId, names);
  }
  const canonicalName = new Map<string, string>();
  for (const [patientId, names] of namesByPatient) {
    let best = '';
    let bestCount = 0;
    for (const [name, count] of names) {
      if (count > bestCount) { best = name; bestCount = count; }
    }
    canonicalName.set(patientId, best);
  }
  for (const { appointment: a } of valid) {
    const name = canonicalName.get(a.patientId)!;
    if (a.patientName !== name) {
      a.patientName = name;
      increment(report.corrected, 'nome_unificado');
    }
  }

  for (const { appointment: a, line } of valid) {
    for (const flag of a.flags) {
      increment(report.warnings, flag);
      report.details.push({ line, id: a.legacyId, action: 'aviso', reason: flag });
    }
  }

  report.details.sort((x, y) => x.line - y.line);
  report.imported = valid.length;
  return { appointments: valid.map((v) => v.appointment), report };
}