import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp, createServices, type AppDependencies } from '../../app.js';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { MongoAppointmentRepository } from '../appointments/appointment.mongo-repository.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { MongoDoctorRepository } from '../doctors/doctor.mongo-repository.js';
import { ConfirmationModel, MessageModel, OfferModel, VacancyModel } from './rescheduling.models.js';
import {
  MongoConfirmationRepository,
  MongoOfferRepository,
  MongoOutbox,
  MongoVacancyRepository,
} from './rescheduling.mongo-repository.js';

const at = (iso: string) => new Date(`${iso}-03:00`);

let server: MongoMemoryServer | null = null;

beforeAll(async () => {
  const externalUrl = process.env.MONGO_TEST_URL;
  if (externalUrl) {
    await mongoose.connect(externalUrl, { dbName: `teste_${Date.now()}` });
  } else {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { dbName: 'teste' });
  }
  await Promise.all([ConfirmationModel.init(), OfferModel.init(), VacancyModel.init(), MessageModel.init()]);
}, 120_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  await Promise.all([
    AppointmentModel.deleteMany({}),
    DoctorModel.deleteMany({}),
    ConfirmationModel.deleteMany({}),
    VacancyModel.deleteMany({}),
    OfferModel.deleteMany({}),
    MessageModel.deleteMany({}),
  ]);
});

describe('repositórios no MongoDB', () => {
  it('uma oferta pendente só pode ser fechada uma vez, mesmo com pedidos simultâneos', async () => {
    const offers = new MongoOfferRepository();
    const offer = await offers.create({
      vacancyId: 'v1',
      appointmentId: 'a1',
      patientId: 'PAC0001',
      previousScheduledAt: at('2026-11-19T09:00:00'),
      status: 'pendente',
      tokenHash: 'hash-1',
      sentAt: at('2026-10-01T12:00:00'),
      expiresAt: at('2026-10-01T14:00:00'),
      answeredAt: null,
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => offers.closeIfPending(offer.id, 'aceita', at('2026-10-01T12:30:00'))),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it('uma vaga aberta só pode ser reservada para uma oferta por vez', async () => {
    const vacancies = new MongoVacancyRepository();
    const vacancy = await vacancies.create({
      doctorId: 'MED01',
      scheduledAt: at('2026-10-03T10:00:00'),
      status: 'aberta',
      origin: { kind: 'cancelamento', appointmentId: 'a1', patientName: 'Carlos Lima' },
      filledByAppointmentId: null,
      createdAt: at('2026-10-01T12:00:00'),
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => vacancies.changeStatus(vacancy.id, ['aberta'], 'oferecida')));
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it('cada consulta tem no máximo um pedido de confirmação', async () => {
    const confirmations = new MongoConfirmationRepository();
    const data = {
      appointmentId: 'a1',
      patientId: 'PAC0001',
      doctorId: 'MED01',
      scheduledAt: at('2026-10-03T10:00:00'),
      status: 'pendente' as const,
      awaitingCancelAnswer: false,
      sentAt: at('2026-10-01T12:00:00'),
      reminderSentAt: null,
      answeredAt: null,
      events: [],
    };
    await confirmations.create({ ...data, tokenHash: 'hash-a' });
    await expect(confirmations.create({ ...data, tokenHash: 'hash-b' })).rejects.toThrow();
  });
});

describe('fluxo completo com MongoDB', () => {
  it('paciente cancela pelo WhatsApp, a vaga é oferecida e só um de dois aceites simultâneos vence', async () => {
    let clock = at('2026-10-01T12:00:00');
    await DoctorModel.create({ _id: 'MED01', name: 'Dr. Paulo Mendes', specialty: 'Cardiologia', schedule: [] });
    const base = { legacyId: null, serviceType: 'convenio', doctorId: 'MED01', status: 'agendada', cancelledAt: null, flags: [] as string[] } as const;
    const carlos = await AppointmentModel.create({
      ...base,
      patientId: 'PAC0001',
      patientName: 'Carlos Lima',
      patientPhone: '49991231234',
      bookedAt: at('2026-09-01T10:00:00'),
      scheduledAt: at('2026-10-03T10:00:00'),
    });
    const ana = await AppointmentModel.create({
      ...base,
      patientId: 'PAC0002',
      patientName: 'Ana Souza',
      patientPhone: '49998764321',
      bookedAt: at('2026-08-31T10:00:00'),
      scheduledAt: at('2026-11-19T09:00:00'),
    });

    const deps: AppDependencies = {
      appointments: new MongoAppointmentRepository(),
      doctors: new MongoDoctorRepository(),
      rescheduling: {
        confirmations: new MongoConfirmationRepository(),
        vacancies: new MongoVacancyRepository(),
        offers: new MongoOfferRepository(),
        outbox: new MongoOutbox(),
      },
      now: () => clock,
      offerTtlMinutes: 120,
      publicUrl: 'http://localhost:5173',
    };
    const services = createServices(deps);
    const app = createApp(deps, services);

    await services.rescheduling!.tick();
    const request1 = await MessageModel.findOne({ patientId: 'PAC0001', kind: 'confirmation_request' }).lean();
    const token = request1!.replyToken!;
    await request(app).post(`/api/patient/confirmations/${token}`).send({ answer: 'no' });
    const cancel = await request(app).post(`/api/patient/confirmations/${token}`).send({ answer: 'cancel' });
    expect(cancel.status).toBe(200);
    expect((await AppointmentModel.findById(carlos._id).lean())?.status).toBe('cancelada_paciente');

    const offerMessage = await MessageModel.findOne({ patientId: 'PAC0002', kind: 'offer' }).lean();
    const offerToken = offerMessage!.link!.split('/oferta/')[1]!;
    clock = at('2026-10-01T12:30:00');
    const results = await Promise.all([
      request(app).post(`/api/patient/offers/${offerToken}/accept`),
      request(app).post(`/api/patient/offers/${offerToken}/accept`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const moved = await AppointmentModel.findById(ana._id).lean();
    expect(moved).toMatchObject({ status: 'confirmada', scheduledAt: at('2026-10-03T10:00:00') });
    expect(await VacancyModel.countDocuments({ 'origin.kind': 'antecipacao' })).toBe(1);
    expect(await VacancyModel.countDocuments({ status: 'preenchida' })).toBe(1);
  });
});