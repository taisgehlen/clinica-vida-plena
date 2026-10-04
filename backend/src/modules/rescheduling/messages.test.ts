import { describe, expect, it } from 'vitest';
import { confirmationRequest, firstName, formatHour, formatLong, offerMessage } from './messages.js';

const doctor = { name: 'Dr. Paulo Mendes', specialty: 'Cardiologia' };

describe('formatação das mensagens', () => {
  it('escreve datas como a clínica fala, no horário de Brasília', () => {
    expect(formatLong(new Date('2026-10-06T17:00:00Z'))).toBe('terça-feira, 06/10, às 14h');
    expect(formatHour(new Date('2026-10-06T17:30:00Z'))).toBe('14h30');
  });

  it('usa só o primeiro nome do paciente', () => {
    expect(firstName('  Ana   Souza Lima ')).toBe('Ana');
  });

  it('o pedido de confirmação traz a consulta e os dois botões', () => {
    const message = confirmationRequest('Carlos Lima', doctor, new Date('2026-10-06T17:00:00Z'));
    expect(message.body).toContain('Olá, Carlos!');
    expect(message.body).toContain('*terça-feira, 06/10, às 14h*');
    expect(message.buttons.map((b) => b.label)).toEqual(['Vou comparecer', 'Não poderei ir']);
  });

  it('a oferta mostra o novo horário, a consulta atual e o prazo', () => {
    const message = offerMessage(
      'Ana Souza',
      doctor,
      new Date('2026-10-06T17:00:00Z'),
      new Date('2026-11-19T12:00:00Z'),
      new Date('2026-10-05T15:20:00Z'),
    );
    expect(message.body).toContain('com o Dr. Paulo Mendes (Cardiologia)');
    expect(message.body).toContain('Sua consulta atual: quinta-feira, 19/11, às 9h');
    expect(message.body).toContain('confirme até as *12h20*');
  });
});
