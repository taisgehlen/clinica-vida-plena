import { isValidObjectId } from 'mongoose';
import { AppointmentModel } from './appointment.model.js';
import type { Appointment, AppointmentRepository, NewAppointment } from './appointment.types.js';

const ACTIVE = { $nin: ['cancelada_paciente', 'cancelada_clinica'] };

// Converts what MongoDB returns into the plain Appointment type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAppointment(doc: any): Appointment {
  return {
    id: String(doc._id),
    legacyId: doc.legacyId ?? null,
    patientId: doc.patientId,
    patientName: doc.patientName,
    patientPhone: doc.patientPhone ?? null,
    serviceType: doc.serviceType,
    doctorId: doc.doctorId,
    bookedAt: doc.bookedAt,
    scheduledAt: doc.scheduledAt,
    status: doc.status,
    cancelledAt: doc.cancelledAt ?? null,
    flags: doc.flags ?? [],
  };
}

export class MongoAppointmentRepository implements AppointmentRepository {
  async findAll(): Promise<Appointment[]> {
    const docs = await AppointmentModel.find().lean();
    return docs.map(toAppointment);
  }

  async findById(id: string): Promise<Appointment | null> {
    // An id that is not a valid ObjectId can never exist; checking first also
    // avoids passing arbitrary input to the database
    if (!isValidObjectId(id)) return null;
    const doc = await AppointmentModel.findById(id).lean();
    return doc ? toAppointment(doc) : null;
  }

  async findActiveByDoctorAt(doctorId: string, scheduledAt: Date): Promise<Appointment | null> {
    const doc = await AppointmentModel.findOne({ doctorId, scheduledAt, status: ACTIVE }).lean();
    return doc ? toAppointment(doc) : null;
  }

  async findActiveByPatientAt(patientId: string, scheduledAt: Date): Promise<Appointment | null> {
    const doc = await AppointmentModel.findOne({ patientId, scheduledAt, status: ACTIVE }).lean();
    return doc ? toAppointment(doc) : null;
  }

  async create(data: NewAppointment): Promise<Appointment> {
    const doc = await AppointmentModel.create(data);
    return toAppointment(doc.toObject());
  }

  async updateStatus(id: string, status: Appointment['status'], cancelledAt: Date | null): Promise<Appointment> {
    const doc = await AppointmentModel.findByIdAndUpdate(id, { status, cancelledAt }, { new: true }).lean();
    if (!doc) throw new Error(`Appointment ${id} disappeared during update`);
    return toAppointment(doc);
  }
}