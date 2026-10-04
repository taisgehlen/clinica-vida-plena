import { describe, expect, it } from 'vitest';
import { buildQueue, canOffer, nextInQueue, offerExpiresAt, type QueueAppointment, type QueueContext } from './queue.js';

const vacancy = { doctorId: 'MED01', scheduledAt: new Date(2026, 9, 6, 14, 0) };

const emptyContext: QueueContext = { alreadyOffered: new Set(), patientsWithOpenOffer: new Set() };

function appointment(id: string, scheduledAt: Date, bookedAt: Date, extra: Partial<QueueAppointment> = {}): QueueAppointment {
  return {
    id,
    patientId: `PAC-${id}`,
    patientPhone: '49999990000',
    doctorId: 'MED01',
    status: 'agendada',
    bookedAt,
    scheduledAt,
    ...extra,
  };
}

const ana = appointment('ana', new Date(2026, 10, 19, 9, 0), new Date(2026, 7, 31));
const bruno = appointment('bruno', new Date(2026, 10, 19, 10, 0), new Date(2026, 8, 14));
const carla = appointment('carla', new Date(2026, 9, 29, 15, 0), new Date(2026, 7, 1));
const diego = appointment('diego', new Date(2026, 9, 8, 8, 0), new Date(2026, 8, 30));

const ids = (entries: { appointment: QueueAppointment }[]) => entries.map((e) => e.appointment.id);

describe('buildQueue', () => {
  it('ordena pela consulta mais longe e desempata por quem marcou primeiro', () => {
    const queue = buildQueue(vacancy, [carla, bruno, ana], emptyContext);
    expect(ids(queue)).toEqual(['ana', 'bruno', 'carla']);
  });

  it('só considera o mesmo médico, consultas ativas e posteriores à vaga', () => {
    const otherDoctor = appointment('outro', new Date(2026, 10, 1), new Date(2026, 8, 1), { doctorId: 'MED02' });
    const cancelled = appointment('cancelada', new Date(2026, 10, 2), new Date(2026, 8, 1), { status: 'cancelada_paciente' });
    const before = appointment('antes', new Date(2026, 9, 6, 9, 0), new Date(2026, 8, 1));
    const confirmed = appointment('confirmada', new Date(2026, 10, 3), new Date(2026, 8, 1), { status: 'confirmada' });
    const queue = buildQueue(vacancy, [otherDoctor, cancelled, before, confirmed], emptyContext);
    expect(ids(queue)).toEqual(['confirmada']);
  });

  it('mantém na fila, com o motivo, quem ganha menos de 1 dia', () => {
    const queue = buildQueue(vacancy, [diego], emptyContext);
    expect(queue[0]?.skip).toBeNull();
    const tooClose = appointment('perto', new Date(2026, 9, 7, 9, 0), new Date(2026, 8, 1));
    expect(buildQueue(vacancy, [tooClose], emptyContext)[0]?.skip).toBe('gain_too_small');
  });

  it('pula quem não tem telefone, quem já recebeu a oferta e quem tem outra oferta aberta', () => {
    const noPhone = appointment('sem-telefone', new Date(2026, 10, 20), new Date(2026, 8, 1), { patientPhone: null });
    const context: QueueContext = { alreadyOffered: new Set(['ana']), patientsWithOpenOffer: new Set(['PAC-bruno']) };
    const queue = buildQueue(vacancy, [noPhone, ana, bruno, carla], context);
    expect(queue.map((e) => e.skip)).toEqual(['no_phone', 'already_offered', 'has_open_offer', null]);
    expect(nextInQueue(queue)?.id).toBe('carla');
  });

  it('devolve null quando ninguém pode receber a oferta', () => {
    expect(nextInQueue(buildQueue(vacancy, [], emptyContext))).toBeNull();
  });
});

describe('canOffer', () => {
  it('só oferece vaga com pelo menos 3 horas de antecedência', () => {
    expect(canOffer(vacancy.scheduledAt, new Date(2026, 9, 6, 11, 0))).toBe(true);
    expect(canOffer(vacancy.scheduledAt, new Date(2026, 9, 6, 11, 1))).toBe(false);
  });
});

describe('offerExpiresAt', () => {
  it('vence depois do tempo de validade', () => {
    expect(offerExpiresAt(new Date(2026, 9, 5, 9, 0), vacancy.scheduledAt, 120)).toEqual(new Date(2026, 9, 5, 11, 0));
  });

  it('vence antes se a vaga ficaria a menos de 3 horas', () => {
    expect(offerExpiresAt(new Date(2026, 9, 6, 10, 0), vacancy.scheduledAt, 120)).toEqual(new Date(2026, 9, 6, 11, 0));
  });
});
