import { Schema, model } from 'mongoose';

const eventSchema = new Schema({ at: { type: Date, required: true }, type: { type: String, required: true } }, { _id: false });

const confirmationSchema = new Schema(
  {
    appointmentId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['pendente', 'confirmada', 'cancelou', 'sem_resposta'], required: true },
    awaitingCancelAnswer: { type: Boolean, default: false },
    tokenHash: { type: String, required: true, unique: true },
    sentAt: { type: Date, required: true },
    reminderSentAt: { type: Date, default: null },
    answeredAt: { type: Date, default: null },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true },
);
confirmationSchema.index({ status: 1 });
confirmationSchema.index({ 'events.at': 1 });

const vacancySchema = new Schema(
  {
    doctorId: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['aberta', 'oferecida', 'preenchida', 'sem_fila', 'em_cima_da_hora'], required: true },
    origin: {
      kind: { type: String, enum: ['cancelamento', 'antecipacao'], required: true },
      appointmentId: { type: String, required: true },
      patientName: { type: String, required: true },
    },
    filledByAppointmentId: { type: String, default: null },
    createdAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
vacancySchema.index({ scheduledAt: 1 });

const offerSchema = new Schema(
  {
    vacancyId: { type: String, required: true },
    appointmentId: { type: String, required: true },
    patientId: { type: String, required: true },
    previousScheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['pendente', 'aceita', 'recusada', 'expirada', 'cancelada'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    sentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: true },
);
offerSchema.index({ vacancyId: 1 });
offerSchema.index({ status: 1, expiresAt: 1 });
offerSchema.index({ sentAt: 1 });

const messageSchema = new Schema(
  {
    patientId: { type: String, required: true },
    patientName: { type: String, required: true },
    phone: { type: String, default: '' },
    direction: { type: String, enum: ['out', 'in'], required: true },
    kind: { type: String, required: true },
    body: { type: String, required: true },
    buttons: { type: [{ label: String, answer: String, _id: false }], default: [] },
    link: { type: String, default: null },
    replyToken: { type: String, default: null },
    confirmationId: { type: String, default: null },
    offerId: { type: String, default: null },
    sentAt: { type: Date, required: true },
  },
  { timestamps: true },
);
messageSchema.index({ patientId: 1, sentAt: 1 });

export const ConfirmationModel = model('Confirmation', confirmationSchema);
export const VacancyModel = model('Vacancy', vacancySchema);
export const OfferModel = model('Offer', offerSchema);
export const MessageModel = model('Message', messageSchema);
