import { HttpError } from '../../utils/http-error.js';
import type { DoctorRepository } from '../doctors/doctor.types.js';
import type { Appointment, AppointmentRepository } from './appointment.types.js';
import type { CreateAppointmentInput } from './appointment.schemas.js';
import { validateSlot } from './rules/slots.js';
import { validateTransition, type Status } from './rules/status.js';

const CANCELLED: Status[] = ['cancelada_paciente', 'cancelada_clinica'];

export type CancellationListener = (appointment: Appointment) => Promise<void>;

export class AppointmentService {
  private readonly cancellationListeners: CancellationListener[] = [];

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly doctors: DoctorRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  onCancelled(listener: CancellationListener): void {
    this.cancellationListeners.push(listener);
  }

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const doctor = await this.doctors.findById(input.doctorId);
    if (!doctor) throw new HttpError(404, 'Médico não encontrado', 'doctor_not_found');

    if (input.scheduledAt <= this.now()) {
      throw new HttpError(422, 'Não é possível agendar consultas no passado', 'scheduled_in_past');
    }

    const slot = validateSlot(doctor.schedule, input.scheduledAt);
    if (!slot.ok) throw new HttpError(422, slot.error, 'invalid_slot');

    if (await this.appointments.findActiveByDoctorAt(doctor.id, input.scheduledAt)) {
      throw new HttpError(409, 'O médico já tem uma consulta neste horário', 'doctor_slot_taken');
    }
    if (await this.appointments.findActiveByPatientAt(input.patientId, input.scheduledAt)) {
      throw new HttpError(409, 'O paciente já tem uma consulta neste horário', 'patient_slot_taken');
    }

    return this.appointments.create({
      legacyId: null,
      patientId: input.patientId,
      patientName: input.patientName,
      patientPhone: input.patientPhone ?? null,
      serviceType: input.serviceType,
      doctorId: doctor.id,
      bookedAt: this.now(),
      scheduledAt: input.scheduledAt,
      status: 'agendada',
      cancelledAt: null,
      flags: [],
    });
  }

  async changeStatus(id: string, next: Status): Promise<Appointment> {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new HttpError(404, 'Consulta não encontrada', 'appointment_not_found');

    const now = this.now();
    const result = validateTransition(appointment.status, next, appointment.scheduledAt, now);
    if (!result.ok) throw new HttpError(422, result.error, 'invalid_transition');

    const isCancellation = CANCELLED.includes(next);
    const updated = await this.appointments.updateStatus(id, next, isCancellation ? now : null);

    if (isCancellation) {
      for (const listener of this.cancellationListeners) await listener(updated);
    }
    return updated;
  }
}
