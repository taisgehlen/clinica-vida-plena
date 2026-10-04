import type { Status } from './rules/status.js';
import type { ServiceType } from '../imports/normalize.js';

export type Appointment = {
  id: string;
  legacyId: string | null;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  serviceType: ServiceType;
  doctorId: string;
  bookedAt: Date;
  scheduledAt: Date;
  status: Status;
  cancelledAt: Date | null;
  flags: string[];
};

export type NewAppointment = Omit<Appointment, 'id'>;

export interface AppointmentRepository {
  findAll(): Promise<Appointment[]>;
  findById(id: string): Promise<Appointment | null>;
  findActiveByDoctorAt(doctorId: string, scheduledAt: Date): Promise<Appointment | null>;
  findActiveByPatientAt(patientId: string, scheduledAt: Date): Promise<Appointment | null>;
  create(data: NewAppointment): Promise<Appointment>;
  updateStatus(id: string, status: Appointment['status'], cancelledAt: Date | null): Promise<Appointment>;
}