import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, createServices, type AppDependencies, type Services } from '../../app.js';
import type { Appointment } from '../appointments/appointment.types.js';
import { InMemoryAppointmentRepository, InMemoryDoctorRepository, drPaulo } from '../../testing/in-memory-repositories.js';
import {
  InMemoryConfirmationRepository,
  InMemoryOfferRepository,
  InMemoryOutbox,
  InMemoryVacancyRepository,
} from '../../testing/in-memory-rescheduling.js';

const at = (iso: string) => new Date(`${iso}-03:00`);

let clock: Date;
let appointments: InMemoryAppointmentRepository;
let confirmations: InMemoryConfirmationRepository;
let vacancies: InMemoryVacancyRepository;
let offers: InMemoryOfferRepository;
let outbox: InMemoryOutbox;
let services: Services;
let app: ReturnType<typeof createApp>;

function add(id: string, patientName: string, scheduledAt: string, bookedAt: string, extra: Partial<Appointment> = {}): Appointment {
  const appointment: Appointment = {
    id,
    legacyId: null,
    patientId: `PAC${id}`,
    patientName,
    patientPhone: '49999990000',
    serviceType: 'convenio',
    doctorId: 'MED01',
    bookedAt: at(bookedAt),
    scheduledAt: at(scheduledAt),
    status: 'agendada',
    cancelledAt: null,
    flags: [],
    ...extra,
  };
  appointments.items.push(appointment);
  return appointment;
}

const find = (id: string) => appointments.items.find((a) => a.id === id)!;
const messagesOf = (id: string) => outbox.items.filter((m) => m.patientId === `PAC${id}`);
const lastMessage = (id: string) => messagesOf(id).at(-1)!;
const replyToken = (id: string) => messagesOf(id).filter((m) => m.replyToken).at(-1)!.replyToken!;
const offerToken = (id: string) => messagesOf(id).filter((m) => m.link).at(-1)!.link!.split('/antecipar/')[1]!;
const answer = (token: string, value: string) => request(app).post(`/api/patient/confirmations/${token}`).send({ answer: value });
const tick = () => services.rescheduling!.tick();

beforeEach(() => {
  clock = at('2026-10-01T12:00:00');
  appointments = new InMemoryAppointmentRepository();
  confirmations = new InMemoryConfirmationRepository();
  vacancies = new InMemoryVacancyRepository();
  offers = new InMemoryOfferRepository();
  outbox = new InMemoryOutbox();
  const deps: AppDependencies = {
    appointments,
    doctors: new InMemoryDoctorRepository([drPaulo]),
    rescheduling: { confirmations, vacancies, offers, outbox },
    now: () => clock,
    offerTtlMinutes: 120,
    publicUrl: 'http://localhost:5173',
  };
  services = createServices(deps);
  app = createApp(deps, services);

  add('0001', 'Carlos Lima', '2026-10-03T10:00:00', '2026-09-01T10:00:00');
  add('0002', 'Ana Souza', '2026-11-19T09:00:00', '2026-08-31T10:00:00');
  add('0003', 'Bruno Alves', '2026-11-19T10:00:00', '2026-09-14T10:00:00');
  add('0004', 'Elisa Prado', '2026-10-02T09:00:00', '2026-09-25T10:00:00');
});

describe('pedido de confirmação', () => {
  it('é enviado só para consulta de risco a 2 dias ou menos, uma única vez', async () => {
    await tick();
    await tick();
    expect(confirmations.items.map((c) => c.appointmentId)).toEqual(['0001']);
    expect(messagesOf('0001').map((m) => m.kind)).toEqual(['confirmation_request']);
    expect(lastMessage('0001').buttons.map((b) => b.answer)).toEqual(['yes', 'no']);
    expect(messagesOf('0004')).toHaveLength(0);
  });

  it('manda o 2º lembrete na véspera e, sem resposta, pede para ligar sem cancelar a consulta', async () => {
    await tick();
    clock = at('2026-10-02T10:00:00');
    await tick();
    expect(lastMessage('0001').kind).toBe('confirmation_reminder');

    clock = at('2026-10-02T22:00:00');
    await tick();
    expect(confirmations.items[0]?.status).toBe('sem_resposta');
    expect(find('0001').status).toBe('agendada');
    expect(vacancies.items).toHaveLength(0);
  });

  it('"Vou comparecer" confirma a consulta e não aceita uma segunda resposta', async () => {
    await tick();
    const res = await answer(replyToken('0001'), 'yes');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmada');
    expect(find('0001').status).toBe('confirmada');
    expect(messagesOf('0001').map((m) => m.kind)).toEqual(['confirmation_request', 'patient_reply', 'confirmation_confirmed']);

    const again = await answer(replyToken('0001'), 'yes');
    expect(again.status).toBe(409);
  });

  it('"Não poderei ir" pergunta antes de cancelar', async () => {
    await tick();
    const token = replyToken('0001');
    expect((await answer(token, 'cancel')).status).toBe(409);
    await answer(token, 'no');
    expect(lastMessage('0001').kind).toBe('confirmation_ask_cancel');
    expect(find('0001').status).toBe('agendada');

    await answer(token, 'keep');
    expect(find('0001').status).toBe('confirmada');
  });

  it('pode ser confirmado por telefone pela recepção', async () => {
    await tick();
    const id = confirmations.items[0]!.id;
    const res = await request(app).post(`/api/rescheduling/confirmations/${id}/confirm-by-phone`);
    expect(res.status).toBe(200);
    expect(find('0001').status).toBe('confirmada');
    expect(confirmations.items[0]?.events.at(-1)?.type).toBe('confirmed_by_phone');
  });

  it('rejeita link em formato inválido (400) e link que não existe (404)', async () => {
    expect((await answer('abc', 'yes')).status).toBe(400);
    expect((await answer('a'.repeat(43), 'yes')).status).toBe(404);
  });
});

describe('vaga e oferta', () => {
  async function patientCancels() {
    await tick();
    const token = replyToken('0001');
    await answer(token, 'no');
    return answer(token, 'cancel');
  }

  it('quando o paciente cancela pelo WhatsApp, a vaga é oferecida a quem está esperando mais longe', async () => {
    const res = await patientCancels();
    expect(res.status).toBe(200);
    expect(find('0001').status).toBe('cancelada_paciente');
    expect(vacancies.items[0]).toMatchObject({ status: 'oferecida', origin: { kind: 'cancelamento', patientName: 'Carlos Lima' } });
    expect(lastMessage('0002').kind).toBe('offer');
    expect(lastMessage('0002').link).toMatch(/^http:\/\/localhost:5173\/antecipar\/[A-Za-z0-9_-]{43}$/);
    expect(messagesOf('0003')).toHaveLength(0);
  });

  it('quando a recepção registra o cancelamento do paciente, a vaga também abre', async () => {
    const res = await request(app).patch('/api/appointments/0001/status').send({ status: 'cancelada_paciente' });
    expect(res.status).toBe(200);
    expect(vacancies.items).toHaveLength(1);
    expect(lastMessage('0002').kind).toBe('offer');
  });

  it('quando a clínica cancela, a vaga não abre', async () => {
    const res = await request(app).patch('/api/appointments/0001/status').send({ status: 'cancelada_clinica' });
    expect(res.status).toBe(200);
    expect(vacancies.items).toHaveLength(0);
  });

  it('o resumo conta quem avisou que não vem, as antecipações e os dias ganhos', async () => {
    await patientCancels();
    await request(app).post(`/api/patient/offers/${offerToken('0002')}/accept`);
    const res = await request(app).get('/api/rescheduling/overview');
    expect(res.body.summary).toMatchObject({ declined: 1, anticipatedThisMonth: 1, daysGainedThisMonth: 47, openVacancies: 0 });
  });

  it('ao aceitar, a consulta é antecipada e o horário antigo vira uma nova vaga', async () => {
    await patientCancels();
    const token = offerToken('0002');

    const view = await request(app).get(`/api/patient/offers/${token}`);
    expect(view.body).toMatchObject({ status: 'pendente', patientFirstName: 'Ana', gainDays: 47 });

    const res = await request(app).post(`/api/patient/offers/${token}/accept`);
    expect(res.status).toBe(200);
    expect(find('0002')).toMatchObject({ status: 'confirmada', scheduledAt: at('2026-10-03T10:00:00') });
    expect(vacancies.items[0]?.status).toBe('preenchida');
    expect(vacancies.items[1]).toMatchObject({ origin: { kind: 'antecipacao' }, status: 'sem_fila' });
    expect(lastMessage('0002').kind).toBe('offer_accepted');

    expect((await request(app).post(`/api/patient/offers/${token}/accept`)).status).toBe(409);
  });

  it('dois aceites ao mesmo tempo: só um vence', async () => {
    await patientCancels();
    const token = offerToken('0002');
    const results = await Promise.all([
      request(app).post(`/api/patient/offers/${token}/accept`),
      request(app).post(`/api/patient/offers/${token}/accept`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(vacancies.items.filter((v) => v.origin.kind === 'antecipacao')).toHaveLength(1);
  });

  it('ao recusar, a oferta passa para o próximo da fila', async () => {
    await patientCancels();
    const res = await request(app).post(`/api/patient/offers/${offerToken('0002')}/decline`);
    expect(res.body.status).toBe('recusada');
    expect(find('0002').scheduledAt).toEqual(at('2026-11-19T09:00:00'));
    expect(lastMessage('0002').kind).toBe('offer_kept');
    expect(lastMessage('0003').kind).toBe('offer');
  });

  it('sem resposta no prazo, a oferta expira e passa para o próximo', async () => {
    await patientCancels();
    const token = offerToken('0002');
    clock = new Date(clock.getTime() + 121 * 60 * 1000);
    expect((await request(app).post(`/api/patient/offers/${token}/accept`)).status).toBe(410);

    await tick();
    expect(offers.items[0]?.status).toBe('expirada');
    expect(lastMessage('0002').kind).toBe('offer_expired');
    expect(lastMessage('0003').kind).toBe('offer');
  });

  it('a recepção pode cancelar uma oferta, e a vaga vai para o próximo', async () => {
    await patientCancels();
    const res = await request(app).post(`/api/rescheduling/offers/${offers.items[0]!.id}/cancel`);
    expect(res.status).toBe(204);
    expect(lastMessage('0003').kind).toBe('offer');
  });

  it('não oferece vaga a menos de 3 horas do horário', async () => {
    clock = at('2026-10-03T08:00:00');
    await request(app).patch('/api/appointments/0001/status').send({ status: 'cancelada_paciente' });
    expect(vacancies.items[0]?.status).toBe('em_cima_da_hora');
    expect(offers.items).toHaveLength(0);
  });

  it('não oferece a quem não tem telefone e mostra o motivo na fila', async () => {
    find('0002').patientPhone = null;
    await request(app).patch('/api/appointments/0001/status').send({ status: 'cancelada_paciente' });
    expect(lastMessage('0003').kind).toBe('offer');
    const overview = await request(app).get('/api/rescheduling/overview');
    expect(overview.body.vacancies[0].queue.map((q: { skip: string | null }) => q.skip)).toEqual(['no_phone', 'already_offered']);
  });
});

describe('telas da recepção', () => {
  it('o resumo mostra vagas, fila e pacientes contatados com o telefone mascarado', async () => {
    await tick();
    await request(app).patch('/api/appointments/0001/status').send({ status: 'cancelada_paciente' });
    const res = await request(app).get('/api/rescheduling/overview');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ openVacancies: 1, anticipatedThisMonth: 0 });
    expect(res.body.vacancies[0]).toMatchObject({ doctorName: 'Dr. Paulo Mendes', status: 'oferecida', pendingOffer: { patientName: 'Ana Souza' } });
    const ana = res.body.contacts.find((c: { patientName: string }) => c.patientName === 'Ana Souza');
    expect(ana).toMatchObject({ phone: '(49) 9****-0000', needsAttention: true, current: { kind: 'offer', status: 'pendente' } });
  });

  it('a lista mostra os próximos 14 dias com antecedência, risco e confirmação, com filtros', async () => {
    await tick();
    const all = await request(app).get('/api/rescheduling/upcoming');
    expect(all.body.map((r: { patientName: string }) => r.patientName)).toEqual(['Elisa Prado', 'Carlos Lima']);
    expect(all.body[1]).toMatchObject({ leadDays: 32, highRisk: true, confirmation: { status: 'pendente' } });
    expect(all.body[0]).toMatchObject({ highRisk: false, confirmation: null, confirmationRequestDate: null });

    const waiting = await request(app).get('/api/rescheduling/upcoming?situation=waiting');
    expect(waiting.body).toHaveLength(1);
    expect((await request(app).get('/api/rescheduling/upcoming?situation=outra')).status).toBe(400);
  });

  it('a conversa simulada só deixa ativos os botões da última mensagem', async () => {
    await tick();
    clock = at('2026-10-02T10:00:00');
    await tick();
    const res = await request(app).get('/api/rescheduling/conversations/PAC0001');
    expect(res.status).toBe(200);
    const [first, reminder] = res.body.messages;
    expect(first.buttons).toEqual([]);
    expect(reminder.buttons).toHaveLength(2);
    expect(reminder.replyToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await request(app).get('/api/rescheduling/conversations/PAC9999')).status).toBe(404);
  });
});