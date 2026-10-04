import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { InMemoryAppointmentRepository, InMemoryDoctorRepository, drPaulo } from '../../testing/in-memory-repositories.js';

const app = createApp({
  appointments: new InMemoryAppointmentRepository(),
  doctors: new InMemoryDoctorRepository([drPaulo]),
  now: () => new Date(2026, 9, 1),
});

describe('GET /api/indicators', () => {
  it('responde sem filtro', async () => {
    const res = await request(app).get('/api/indicators');
    expect(res.status).toBe(200);
    expect(res.body.period).toEqual({ from: null, to: null });
    expect(res.body.byDoctor).toHaveLength(1);
  });

  it('inclui a ocupação da agenda na resposta', async () => {
    const res = await request(app).get('/api/indicators?from=2026-03-02&to=2026-03-08');
    expect(res.status).toBe(200);
    expect(res.body.schedule).toMatchObject({ capacity: 20, occupied: 0, free: 20 });
    expect(res.body.schedule.byDoctor[0]).toMatchObject({ doctorId: 'MED01', capacity: 20 });
  });

  it('aceita período válido', async () => {
    const res = await request(app).get('/api/indicators?from=2026-01-01&to=2026-06-30');
    expect(res.status).toBe(200);
    expect(res.body.period).toEqual({ from: '2026-01-01', to: '2026-06-30' });
  });

  it.each([
    ['formato errado', 'from=01/01/2026'],
    ['data inexistente', 'from=2026-02-30'],
    ['início depois do fim', 'from=2026-06-30&to=2026-01-01'],
  ])('rejeita %s (400)', async (_name, query) => {
    const res = await request(app).get(`/api/indicators?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('rejeita parâmetro repetido (tentativa de mandar lista no lugar de texto)', async () => {
    const res = await request(app).get('/api/indicators?from=2026-01-01&from=2026-02-01');
    expect(res.status).toBe(400);
  });
});