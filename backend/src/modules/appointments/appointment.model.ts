import { Schema, model, type InferSchemaType } from 'mongoose';

const STATUSES = ['agendada', 'confirmada', 'realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'];
const FLAGS = ['fora_da_grade', 'conflito_de_horario', 'pendente_de_fechamento', 'cancelamento_assumido_paciente'];

const appointmentSchema = new Schema(
  {
    legacyId: { type: String, default: null },
    patientId: { type: String, required: true },
    patientName: { type: String, required: true },
    patientPhone: { type: String, default: null },
    serviceType: { type: String, enum: ['convenio', 'particular'], required: true },
    doctorId: { type: String, required: true, ref: 'Doctor' },
    bookedAt: { type: Date, required: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: STATUSES, required: true },
    cancelledAt: { type: Date, default: null },
    flags: { type: [String], enum: FLAGS, default: [] },
  },
  { timestamps: true },
);

appointmentSchema.index({ doctorId: 1, scheduledAt: 1 });
appointmentSchema.index({ patientId: 1, scheduledAt: 1 });
appointmentSchema.index({ scheduledAt: 1 });

export type AppointmentDocument = InferSchemaType<typeof appointmentSchema>;
export const AppointmentModel = model('Appointment', appointmentSchema);