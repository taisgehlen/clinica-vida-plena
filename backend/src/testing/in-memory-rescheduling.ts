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
} from '../modules/rescheduling/rescheduling.types.js';

let sequence = 1;
const nextId = (prefix: string) => `${prefix}${sequence++}`;

export class InMemoryConfirmationRepository implements ConfirmationRepository {
  items: Confirmation[] = [];

  async create(data: NewConfirmation) {
    const item = { ...data, events: [...data.events], id: nextId('C') };
    this.items.push(item);
    return item;
  }
  async findById(id: string) {
    return this.items.find((c) => c.id === id) ?? null;
  }
  async findByTokenHash(tokenHash: string) {
    return this.items.find((c) => c.tokenHash === tokenHash) ?? null;
  }
  async findByAppointmentIds(ids: string[]) {
    return this.items.filter((c) => ids.includes(c.appointmentId));
  }
  async findPending() {
    return this.items.filter((c) => c.status === 'pendente');
  }
  async findSince(since: Date) {
    return this.items.filter((c) => c.events.some((e) => e.at.getTime() >= since.getTime()));
  }
  async update(id: string, changes: Partial<NewConfirmation>, newEvent: TimelineEvent<ConfirmationEventType>) {
    const item = this.items.find((c) => c.id === id)!;
    Object.assign(item, changes);
    item.events.push(newEvent);
    return item;
  }
}

export class InMemoryVacancyRepository implements VacancyRepository {
  items: Vacancy[] = [];

  async create(data: NewVacancy) {
    const item = { ...data, id: nextId('V') };
    this.items.push(item);
    return item;
  }
  async findById(id: string) {
    return this.items.find((v) => v.id === id) ?? null;
  }
  async findFrom(from: Date) {
    return this.items.filter((v) => v.scheduledAt.getTime() >= from.getTime());
  }
  async changeStatus(id: string, from: VacancyStatus[], to: VacancyStatus, filledByAppointmentId?: string) {
    const item = this.items.find((v) => v.id === id);
    if (!item || !from.includes(item.status)) return null;
    item.status = to;
    if (filledByAppointmentId) item.filledByAppointmentId = filledByAppointmentId;
    return item;
  }
}

export class InMemoryOfferRepository implements OfferRepository {
  items: Offer[] = [];

  async create(data: NewOffer) {
    const item = { ...data, id: nextId('O') };
    this.items.push(item);
    return item;
  }
  async findById(id: string) {
    return this.items.find((o) => o.id === id) ?? null;
  }
  async findByTokenHash(tokenHash: string) {
    return this.items.find((o) => o.tokenHash === tokenHash) ?? null;
  }
  async findByVacancy(vacancyId: string) {
    return this.items.filter((o) => o.vacancyId === vacancyId);
  }
  async findPending() {
    return this.items.filter((o) => o.status === 'pendente');
  }
  async findSince(since: Date) {
    return this.items.filter((o) => o.sentAt.getTime() >= since.getTime());
  }
  async findAccepted() {
    return this.items.filter((o) => o.status === 'aceita');
  }
  async closeIfPending(id: string, status: Exclude<OfferStatus, 'pendente'>, at: Date) {
    const item = this.items.find((o) => o.id === id);
    if (!item || item.status !== 'pendente') return null;
    item.status = status;
    item.answeredAt = at;
    return item;
  }
}

export class InMemoryOutbox implements Outbox {
  items: Message[] = [];

  async send(data: NewMessage) {
    const item = { ...data, id: nextId('M') };
    this.items.push(item);
    return item;
  }
  async findByPatient(patientId: string) {
    return this.items.filter((m) => m.patientId === patientId);
  }
}
