import { isValidObjectId } from 'mongoose';
import { ConfirmationModel, MessageModel, OfferModel, VacancyModel } from './rescheduling.models.js';
import type {
  Confirmation,
  ConfirmationEventType,
  ConfirmationRepository,
  Message,
  NewConfirmation,
  NewMessage,
  NewOffer,
  NewVacancy,
  Offer,
  OfferRepository,
  OfferStatus,
  Outbox,
  TimelineEvent,
  Vacancy,
  VacancyRepository,
  VacancyStatus,
} from './rescheduling.types.js';

const toConfirmation = (d: any): Confirmation => ({
  id: String(d._id),
  appointmentId: d.appointmentId,
  patientId: d.patientId,
  doctorId: d.doctorId,
  scheduledAt: d.scheduledAt,
  status: d.status,
  awaitingCancelAnswer: d.awaitingCancelAnswer ?? false,
  tokenHash: d.tokenHash,
  sentAt: d.sentAt,
  reminderSentAt: d.reminderSentAt ?? null,
  answeredAt: d.answeredAt ?? null,
  events: (d.events ?? []).map((e: any) => ({ at: e.at, type: e.type })),
});

const toVacancy = (d: any): Vacancy => ({
  id: String(d._id),
  doctorId: d.doctorId,
  scheduledAt: d.scheduledAt,
  status: d.status,
  origin: { kind: d.origin.kind, appointmentId: d.origin.appointmentId, patientName: d.origin.patientName },
  filledByAppointmentId: d.filledByAppointmentId ?? null,
  createdAt: d.createdAt,
});

const toOffer = (d: any): Offer => ({
  id: String(d._id),
  vacancyId: d.vacancyId,
  appointmentId: d.appointmentId,
  patientId: d.patientId,
  previousScheduledAt: d.previousScheduledAt,
  status: d.status,
  tokenHash: d.tokenHash,
  sentAt: d.sentAt,
  expiresAt: d.expiresAt,
  answeredAt: d.answeredAt ?? null,
});

const toMessage = (d: any): Message => ({
  id: String(d._id),
  patientId: d.patientId,
  patientName: d.patientName,
  phone: d.phone ?? '',
  direction: d.direction,
  kind: d.kind,
  body: d.body,
  buttons: (d.buttons ?? []).map((b: any) => ({ label: b.label, answer: b.answer })),
  link: d.link ?? null,
  replyToken: d.replyToken ?? null,
  confirmationId: d.confirmationId ?? null,
  offerId: d.offerId ?? null,
  sentAt: d.sentAt,
});

export class MongoConfirmationRepository implements ConfirmationRepository {
  async create(data: NewConfirmation) {
    return toConfirmation((await ConfirmationModel.create(data)).toObject());
  }
  async findById(id: string) {
    if (!isValidObjectId(id)) return null;
    const doc = await ConfirmationModel.findById(id).lean();
    return doc ? toConfirmation(doc) : null;
  }
  async findByTokenHash(tokenHash: string) {
    const doc = await ConfirmationModel.findOne({ tokenHash }).lean();
    return doc ? toConfirmation(doc) : null;
  }
  async findByAppointmentIds(ids: string[]) {
    return (await ConfirmationModel.find({ appointmentId: { $in: ids } }).lean()).map(toConfirmation);
  }
  async findPending() {
    return (await ConfirmationModel.find({ status: 'pendente' }).lean()).map(toConfirmation);
  }
  async findSince(since: Date) {
    return (await ConfirmationModel.find({ 'events.at': { $gte: since } }).lean()).map(toConfirmation);
  }
  async update(id: string, changes: Partial<NewConfirmation>, newEvent: TimelineEvent<ConfirmationEventType>) {
    const doc = await ConfirmationModel.findByIdAndUpdate(id, { $set: changes, $push: { events: newEvent } }, { new: true }).lean();
    if (!doc) throw new Error(`Confirmation ${id} disappeared during update`);
    return toConfirmation(doc);
  }
}

export class MongoVacancyRepository implements VacancyRepository {
  async create(data: NewVacancy) {
    return toVacancy((await VacancyModel.create(data)).toObject());
  }
  async findById(id: string) {
    if (!isValidObjectId(id)) return null;
    const doc = await VacancyModel.findById(id).lean();
    return doc ? toVacancy(doc) : null;
  }
  async findFrom(from: Date) {
    return (await VacancyModel.find({ scheduledAt: { $gte: from } }).lean()).map(toVacancy);
  }
  async changeStatus(id: string, from: VacancyStatus[], to: VacancyStatus, filledByAppointmentId?: string) {
    if (!isValidObjectId(id)) return null;
    const changes = filledByAppointmentId ? { status: to, filledByAppointmentId } : { status: to };
    const doc = await VacancyModel.findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: changes }, { new: true }).lean();
    return doc ? toVacancy(doc) : null;
  }
}

export class MongoOfferRepository implements OfferRepository {
  async create(data: NewOffer) {
    return toOffer((await OfferModel.create(data)).toObject());
  }
  async findById(id: string) {
    if (!isValidObjectId(id)) return null;
    const doc = await OfferModel.findById(id).lean();
    return doc ? toOffer(doc) : null;
  }
  async findByTokenHash(tokenHash: string) {
    const doc = await OfferModel.findOne({ tokenHash }).lean();
    return doc ? toOffer(doc) : null;
  }
  async findByVacancy(vacancyId: string) {
    return (await OfferModel.find({ vacancyId }).lean()).map(toOffer);
  }
  async findPending() {
    return (await OfferModel.find({ status: 'pendente' }).lean()).map(toOffer);
  }
  async findSince(since: Date) {
    return (await OfferModel.find({ sentAt: { $gte: since } }).lean()).map(toOffer);
  }
  async findAccepted() {
    return (await OfferModel.find({ status: 'aceita' }).lean()).map(toOffer);
  }
  async closeIfPending(id: string, status: Exclude<OfferStatus, 'pendente'>, at: Date) {
    if (!isValidObjectId(id)) return null;
    const doc = await OfferModel.findOneAndUpdate({ _id: id, status: 'pendente' }, { $set: { status, answeredAt: at } }, { new: true }).lean();
    return doc ? toOffer(doc) : null;
  }
}

export class MongoOutbox implements Outbox {
  async send(data: NewMessage) {
    return toMessage((await MessageModel.create(data)).toObject());
  }
  async findByPatient(patientId: string) {
    return (await MessageModel.find({ patientId }).sort({ sentAt: 1 }).lean()).map(toMessage);
  }
}
