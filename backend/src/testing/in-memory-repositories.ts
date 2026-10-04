import type { Appointment, AppointmentRepository, NewAppointment } from '../modules/appointments/appointment.types.js';
import type { Doctor, DoctorRepository } from '../modules/doctors/doctor.types.js';

const isActive = (a: Appointment) => a.status !== 'cancelada_paciente' && a.status !== 'cancelada_clinica';

export class InMemoryAppointmentRepository implements AppointmentRepository {
  items: Appointment[] = [];
  private nextId = 1;

  async findAll() {
    return this.items;
  }
  async findById(id: string) {
    return this.items.find((a) => a.id === id) ?? null;
  }
  async findByIds(ids: string[]) {
    return this.items.filter((a) => ids.includes(a.id));
  }
  async findActiveFrom(from: Date) {
    return this.items
      .filter((a) => (a.status === 'agendada' || a.status === 'confirmada') && a.scheduledAt.getTime() >= from.getTime())
      .sort((x, y) => x.scheduledAt.getTime() - y.scheduledAt.getTime());
  }
  async findActiveByDoctorAt(doctorId: string, at: Date) {
    return this.items.find((a) => isActive(a) && a.doctorId === doctorId && a.scheduledAt.getTime() === at.getTime()) ?? null;
  }
  async findActiveByPatientAt(patientId: string, at: Date) {
    return this.items.find((a) => isActive(a) && a.patientId === patientId && a.scheduledAt.getTime() === at.getTime()) ?? null;
  }
  async create(data: NewAppointment) {
    const appointment = { ...data, id: String(this.nextId++) };
    this.items.push(appointment);
    return appointment;
  }
  async updateStatus(id: string, status: Appointment['status'], cancelledAt: Date | null) {
    const appointment = this.items.find((a) => a.id === id)!;
    appointment.status = status;
    appointment.cancelledAt = cancelledAt;
    return appointment;
  }
  async reschedule(id: string, scheduledAt: Date, status: Appointment['status']) {
    const appointment = this.items.find((a) => a.id === id)!;
    appointment.scheduledAt = scheduledAt;
    appointment.status = status;
    return appointment;
  }
}

export class InMemoryDoctorRepository implements DoctorRepository {
  constructor(private readonly doctors: Doctor[]) {}
  async findAll() {
    return this.doctors;
  }
  async findById(id: string) {
    return this.doctors.find((d) => d.id === id) ?? null;
  }
}

export const drPaulo: Doctor = {
  id: 'MED01',
  name: 'Dr. Paulo Mendes',
  specialty: 'Cardiologia',
  schedule: [
    { dia: 'segunda', inicio: '07:00', fim: '12:00' },
    { dia: 'quarta', inicio: '07:00', fim: '12:00' },
  ],
};
