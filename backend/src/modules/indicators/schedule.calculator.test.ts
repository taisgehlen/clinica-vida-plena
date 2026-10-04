import { describe, it, expect } from 'vitest';
import { computeSchedule, type ScheduleAppointment, type ScheduleDoctor } from './schedule.calculator.js';


const doctors: ScheduleDoctor[] = [
  {
    id: 'MED01',
    schedule: [
      { dia: 'segunda', inicio: '08:00', fim: '10:00' },
      { dia: 'quarta', inicio: '14:00', fim: '15:00' },
    ],
  },
  { id: 'MED02', schedule: [{ dia: 'terca', inicio: '08:00', fim: '09:00' }] },
];

// Week used in the tests: Monday 2026-03-02 to Sunday 2026-03-08
const weekStart = new Date(2026, 2, 2);
const weekEnd = new Date(2026, 2, 8, 23, 59, 59, 999);
const later = new Date(2026, 2, 20); // "now", after the whole week

const monday = (h: number, m = 0) => new Date(2026, 2, 2, h, m);
const tuesday = (h: number, m = 0) => new Date(2026, 2, 3, h, m);

function appt(overrides: Partial<ScheduleAppointment> = {}): ScheduleAppointment {
  return { doctorId: 'MED01', scheduledAt: monday(8), status: 'realizada', ...overrides };
}

const run = (items: ScheduleAppointment[], now = later, from: Date | null = weekStart, to: Date | null = weekEnd) =>
  computeSchedule(items, doctors, from, to, now);

describe('capacidade da grade', () => {
  it('soma os horários de 30 minutos de cada médico nos dias do período', () => {
    const result = run([]);
    expect(result.capacity).toBe(8);
    expect(result.byDoctor).toEqual([
      { doctorId: 'MED01', capacity: 6, occupied: 0, occupancyRate: 0 },
      { doctorId: 'MED02', capacity: 2, occupied: 0, occupancyRate: 0 },
    ]);
  });

  it('não conta a grade depois de agora (o futuro ainda pode ser agendado)', () => {
    // now = Monday 09:00 -> MED01 has 08:00, 08:30 and 09:00 behind it; nothing else yet
    const result = run([], monday(9));
    expect(result.capacity).toBe(3);
  });

  it('sem data inicial, começa no dia da primeira consulta registrada', () => {
    const result = run([appt({ scheduledAt: tuesday(8) })], later, null, weekEnd);
    expect(result.capacity).toBe(2 + 2); // Tuesday (MED02) + Wednesday (MED01)
  });

  it('devolve taxa nula quando não há grade no período', () => {
    const result = run([], monday(7)); // before the first slot of the week
    expect(result.capacity).toBe(0);
    expect(result.occupancyRate).toBeNull();
  });
});

describe('horários ocupados', () => {
  it('conta consulta realizada, falta e aberta como horário ocupado', () => {
    const result = run([
      appt({ scheduledAt: monday(8), status: 'realizada' }),
      appt({ scheduledAt: monday(8, 30), status: 'falta' }),
      appt({ scheduledAt: monday(9), status: 'agendada' }),
    ]);
    expect(result.occupied).toBe(3);
    expect(result.free).toBe(5);
    expect(result.occupancyRate).toBe(0.375); // 3 of 8
  });

  it('não conta consulta cancelada como ocupação', () => {
    const result = run([appt({ status: 'cancelada_paciente' })]);
    expect(result.occupied).toBe(0);
  });

  it('conta o horário uma vez só quando há duas consultas nele (conflito do histórico)', () => {
    const result = run([appt({ status: 'realizada' }), appt({ status: 'falta' })]);
    expect(result.occupied).toBe(1);
  });

  it('ignora consulta fora da grade do médico', () => {
    // MED01 does not work on Tuesday
    const result = run([appt({ scheduledAt: tuesday(8) })]);
    expect(result.occupied).toBe(0);
  });

  it('separa a ocupação por médico', () => {
    const result = run([appt(), appt({ doctorId: 'MED02', scheduledAt: tuesday(8) })]);
    expect(result.byDoctor.map((d) => [d.doctorId, d.occupied, d.occupancyRate])).toEqual([
      ['MED01', 1, 0.167],
      ['MED02', 1, 0.5],
    ]);
  });
});

describe('cancelamentos preenchidos', () => {
  it('é preenchido quando outro paciente ficou com o mesmo médico e horário', () => {
    const result = run([
      appt({ scheduledAt: monday(8), status: 'cancelada_paciente' }),
      appt({ scheduledAt: monday(8), status: 'realizada' }), // took the freed slot
      appt({ scheduledAt: monday(9), status: 'cancelada_clinica' }), // nobody took it
    ]);
    expect(result.cancellations).toEqual({ total: 2, filled: 1, unfilled: 1 });
  });
});