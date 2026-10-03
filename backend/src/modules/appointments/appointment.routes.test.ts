import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  InMemoryAppointmentRepository,
  InMemoryDoctorRepository,
  drPaulo,
} from '../../testing/in-memory-repositories.js';

// Fixed clock: Thursday 2026-10-01 12:00 (São Paulo)
const NOW = new Date('2026-10-01T12:00:00-03:00');

// Monday 2026-10-05 08:00 (inside Dr. Paulo's schedule, in the future)
const valid = {
  patientId: 'PAC0001',
  patientName: 'Maria Silva',
  patientPhone: '53964703160',
  serviceType: 'convenio',
  doctorId: 'MED01',
  scheduledAt: '2026-10-05T08:00:00-03:00',
};

let repo: InMemoryAppointmentRepository;
let clock: Date;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  repo = new InMemoryAppointmentRepository();
  clock = NOW;
  app = createApp({
    appointments: repo,
    doctors: new InMemoryDoctorRepository([drPaulo]),
    now: () => clock,
  });
});

const createBooking = (body: object = valid) => request(app).post('/api/appointments').send(body);
const changeStatus = (id: string, status: string) =>
  request(app).patch(`/api/appointments/${id}/status`).send({ status });

describe('POST /api/appointments', () => {
  it('cria uma consulta agendada', async () => {
    const res = await createBooking();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      patientId: 'PAC0001',
      doctorId: 'MED01',
      status: 'agendada',
      legacyId: null,
      cancelledAt: null,
    });
    expect(new Date(res.body.scheduledAt)).toEqual(new Date('2026-10-05T08:00:00-03:00'));
    expect(new Date(res.body.bookedAt)).toEqual(NOW);
  });

  describe('validação da entrada (400)', () => {
    it.each([
      ['sem paciente', { ...valid, patientId: undefined }],
      ['patientId em formato errado', { ...valid, patientId: 'abc' }],
      ['tipo de atendimento inválido', { ...valid, serviceType: 'sus' }],
      ['data sem fuso horário', { ...valid, scheduledAt: '2026-10-05T08:00:00' }],
      ['data inválida', { ...valid, scheduledAt: 'amanhã' }],
      ['telefone com letras', { ...valid, patientPhone: '53abc' }],
    ])('rejeita %s', async (_name, body) => {
      const res = await createBooking(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
    });

    it('rejeita objeto no lugar de texto (tentativa de injeção NoSQL)', async () => {
      const res = await createBooking({ ...valid, patientId: { $ne: null } });
      expect(res.status).toBe(400);
      expect(repo.items).toHaveLength(0);
    });
  });

  it('responde 404 para médico inexistente', async () => {
    const res = await createBooking({ ...valid, doctorId: 'MED99' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('doctor_not_found');
  });

  it('rejeita agendamento no passado', async () => {
    const res = await createBooking({ ...valid, scheduledAt: '2026-09-28T08:00:00-03:00' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('scheduled_in_past');
  });

  it('rejeita horário fora da grade do médico', async () => {
    const res = await createBooking({ ...valid, scheduledAt: '2026-10-06T08:00:00-03:00' }); // terça
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({ code: 'invalid_slot', message: 'O médico não atende neste dia da semana' });
  });

  it('rejeita horário quebrado (08:15)', async () => {
    const res = await createBooking({ ...valid, scheduledAt: '2026-10-05T08:15:00-03:00' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_slot');
  });

  it('rejeita segundo paciente no mesmo horário do médico (409)', async () => {
    await createBooking();
    const res = await createBooking({ ...valid, patientId: 'PAC0002', patientName: 'João' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('doctor_slot_taken');
  });

  it('libera o horário quando a consulta anterior foi cancelada', async () => {
    const first = await createBooking();
    await changeStatus(first.body.id, 'cancelada_paciente');
    const res = await createBooking({ ...valid, patientId: 'PAC0002', patientName: 'João' });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/appointments/:id/status', () => {
  it('confirma uma consulta antes do horário', async () => {
    const { body } = await createBooking();
    const res = await changeStatus(body.id, 'confirmada');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmada');
  });

  it('registra a data do cancelamento (decisão 1)', async () => {
    const { body } = await createBooking();
    const res = await changeStatus(body.id, 'cancelada_paciente');
    expect(res.status).toBe(200);
    expect(new Date(res.body.cancelledAt)).toEqual(NOW);
  });

  it('rejeita falta antes do horário com a mensagem da regra (422)', async () => {
    const { body } = await createBooking();
    const res = await changeStatus(body.id, 'falta');
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: 'invalid_transition',
      message: 'Realizada e falta só podem ser registradas a partir do horário da consulta',
    });
  });

  it('permite registrar falta depois do horário', async () => {
    const { body } = await createBooking();
    clock = new Date('2026-10-05T09:00:00-03:00');
    const res = await changeStatus(body.id, 'falta');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('falta');
  });

  it('não altera status final', async () => {
    const { body } = await createBooking();
    clock = new Date('2026-10-05T09:00:00-03:00');
    await changeStatus(body.id, 'realizada');
    const res = await changeStatus(body.id, 'falta');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Status final não pode ser alterado');
  });

  it('rejeita status desconhecido (400)', async () => {
    const { body } = await createBooking();
    const res = await changeStatus(body.id, 'remarcada');
    expect(res.status).toBe(400);
  });

  it('responde 404 para consulta inexistente', async () => {
    const res = await changeStatus('999', 'confirmada');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('appointment_not_found');
  });
});

describe('GET /api/doctors', () => {
  it('lista os médicos com a grade', async () => {
    const res = await request(app).get('/api/doctors');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([drPaulo]);
  });
});

describe('mensagens de validação', () => {
  it('explica em português o que está errado', async () => {
    const res = await createBooking({ ...valid, patientName: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/^Dados inválidos: patientName: /);
    expect(res.body.error.message).not.toMatch(/Too small/);
  });
});