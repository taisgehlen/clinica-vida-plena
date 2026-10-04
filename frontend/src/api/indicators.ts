
import { apiGet } from './client';
 
export type Rate = {
  completed: number;
  noShows: number;
  noShowRate: number | null;
};
 
export type DoctorSchedule = {
  doctorId: string;
  capacity: number;
  occupied: number;
  occupancyRate: number | null;
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
  schedule: {
    capacity: number;
    occupied: number;
    free: number;
    occupancyRate: number | null;
    cancellations: { total: number; filled: number; unfilled: number };
    byDoctor: DoctorSchedule[];
  };
};
 
export type Period = { from: string; to: string };
 
export function getIndicators(period: Period, signal?: AbortSignal): Promise<Indicators> {
  return apiGet<Indicators>('/api/indicators', {
    params: { from: period.from || undefined, to: period.to || undefined },
    signal,
  });
}
 
