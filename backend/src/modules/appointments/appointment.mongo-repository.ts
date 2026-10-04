import { isValidObjectId } from 'mongoose';
import { AppointmentModel } from './appointment.model.js';
import type { Appointment, AppointmentRepository, NewAppointment } from './appointment.types.js';

const ACTIVE = { $nin: ['cancelada_paciente', 'cancelada_clinica'] };
const OPEN = { $in: ['agendada', 'confirmada'] };

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
    if (!isValidObjectId(id)) return null;
    const doc = await AppointmentModel.findById(id).lean();
    return doc ? toAppointment(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Appointment[]> {
    const valid = ids.filter((id) => isValidObjectId(id));
    const docs = await AppointmentModel.find({ _id: { $in: valid } }).lean();
    return docs.map(toAppointment);
  }

  async findActiveFrom(from: Date): Promise<Appointment[]> {
    const docs = await AppointmentModel.find({ scheduledAt: { $gte: from }, status: OPEN }).sort({ scheduledAt: 1 }).lean();
    return docs.map(toAppointment);
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

  async reschedule(id: string, scheduledAt: Date, status: Appointment['status']): Promise<Appointment> {
    const doc = await AppointmentModel.findByIdAndUpdate(id, { scheduledAt, status }, { new: true }).lean();
    if (!doc) throw new Error(`Appointment ${id} disappeared during update`);
    return toAppointment(doc);
  }
}
