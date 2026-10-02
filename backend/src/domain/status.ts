export type Status =
  | 'agendada'
  | 'confirmada'
  | 'realizada'
  | 'falta'
  | 'cancelada_paciente'
  | 'cancelada_clinica';

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: string };

const FINAL_STATUSES: Status[] = [
  'realizada',
  'falta',
  'cancelada_paciente',
  'cancelada_clinica',
];

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  agendada: ['confirmada', 'realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'],
  confirmada: ['realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'],
  realizada: [],
  falta: [],
  cancelada_paciente: [],
  cancelada_clinica: [],
};

const REQUIRES_STARTED: Status[] = ['realizada', 'falta'];

const REQUIRES_NOT_STARTED: Status[] = ['confirmada', 'cancelada_paciente', 'cancelada_clinica'];

export function validateTransition(
  current: Status,
  next: Status,
  appointmentTime: Date,
  now: Date,
): TransitionResult {
  if (FINAL_STATUSES.includes(current)) {
    return { ok: false, error: 'Status final não pode ser alterado' };
  }

  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    return { ok: false, error: `Transição de ${current} para ${next} não é permitida` };
  }

  const hasStarted = now >= appointmentTime;

  if (REQUIRES_STARTED.includes(next) && !hasStarted) {
    return {
      ok: false,
      error: 'Realizada e falta só podem ser registradas a partir do horário da consulta',
    };
  }

  if (REQUIRES_NOT_STARTED.includes(next) && hasStarted) {
    return {
      ok: false,
      error: 'Confirmação e cancelamento só são permitidos antes do horário da consulta',
    };
  }

  return { ok: true };
}