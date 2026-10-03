import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const app = createApp();

describe('app', () => {
  it('responde ao health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('envia cabeçalhos de segurança (helmet)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('libera CORS só para o frontend', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const other = await request(app).get('/api/health').set('Origin', 'http://site-estranho.com');
    expect(other.headers['access-control-allow-origin']).not.toBe('http://site-estranho.com');
    expect(other.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('responde 404 no formato padrão para rota inexistente', async () => {
    const res = await request(app).get('/api/nada');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'Rota não encontrada' } });
  });

  it('responde 400 para JSON malformado', async () => {
    const res = await request(app).post('/api/health').set('Content-Type', 'application/json').send('{quebrado');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });

  it('responde 413 para corpo grande demais', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: 'x'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });
});