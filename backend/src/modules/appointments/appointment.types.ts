import type { Status } from './rules/status.js';
import type { ServiceType } from '../imports/normalize.js';

// An appointment as the rest of the code sees it (independent of MongoDB)
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

// What the service needs from storage. MongoDB implements it in production;
// the tests use an in-memory version, so they run without a database.
export interface AppointmentRepository {
  findAll(): Promise<Appointment[]>;
  findById(id: string): Promise<Appointment | null>;
  // Not cancelled = still occupying the slot
  findActiveByDoctorAt(doctorId: string, scheduledAt: Date): Promise<Appointment | null>;
  findActiveByPatientAt(patientId: string, scheduledAt: Date): Promise<Appointment | null>;
  create(data: NewAppointment): Promise<Appointment>;
  updateStatus(id: string, status: Appointment['status'], cancelledAt: Date | null): Promise<Appointment>;
}