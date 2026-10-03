import type { Status } from '../appointments/rules/status.js';

export type ServiceType = 'convenio' | 'particular';

export type NormalizedStatus = {
  status: Status;
  assumedPatientCancellation: boolean;
};


function simplify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();
}

const STATUS_MAP: Record<string, Status> = {
  agendada: 'agendada',
  confirmada: 'confirmada',
  confirmado: 'confirmada',
  realizada: 'realizada',
  atendido: 'realizada',
  falta: 'falta',
  faltou: 'falta',
  'no show': 'falta',
  ausente: 'falta',
  'cancelada paciente': 'cancelada_paciente',
  'cancelado pelo paciente': 'cancelada_paciente',
  desmarcou: 'cancelada_paciente',
  'cancelada clinica': 'cancelada_clinica',
  'cancelado clinica': 'cancelada_clinica',
};

export function normalizeStatus(raw: string | undefined): NormalizedStatus | null {
  if (!raw) return null;
  const key = simplify(raw);
  if (key === '') return null;
  if (key === 'cancelado' || key === 'cancelada') {
    return { status: 'cancelada_paciente', assumedPatientCancellation: true };
  }

  const status = STATUS_MAP[key];
  return status ? { status, assumedPatientCancellation: false } : null;
}

export function normalizeServiceType(raw: string | undefined): ServiceType | null {
  if (!raw) return null;
  const key = simplify(raw);
  if (key === 'convenio') return 'convenio';
  if (key === 'particular') return 'particular';
  return null;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/; // 2025-10-02 15:00
const BR = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/; // 02/10/2025 15:00

export type ParsedDate = { date: Date; format: 'iso' | 'br' };

export function parseDateTime(raw: string | undefined): ParsedDate | null {
  if (!raw) return null;
  const value = raw.trim();

  let parts: [number, number, number, number, number] | null = null;
  let format: 'iso' | 'br' = 'iso';

  const iso = ISO.exec(value);
  const br = BR.exec(value);
  if (iso) {
    parts = [Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4]), Number(iso[5])];
  } else if (br) {
    parts = [Number(br[3]), Number(br[2]), Number(br[1]), Number(br[4]), Number(br[5])];
    format = 'br';
  }
  if (!parts) return null;

  const [year, month, day, hour, minute] = parts;
  const date = new Date(year, month - 1, day, hour, minute);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return { date, format };
}

export function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}