import { describe, it, expect } from 'vitest';
import { computeIndicators, type IndicatorAppointment, type IndicatorDoctor } from './indicators.calculator.js';

const doctors: IndicatorDoctor[] = [
  { id: 'MED01', name: 'Dr. Paulo Mendes', specialty: 'Cardiologia' },
  { id: 'MED02', name: 'Dra. Ana Ribeiro', specialty: 'Dermatologia' },
];

let counter = 0;

function appt(overrides: Partial<IndicatorAppointment> = {}): IndicatorAppointment {
  counter += 1;
  return {
    patientId: `PAC${String(counter).padStart(4, '0')}`,
    patientName: `Paciente ${counter}`,
    doctorId: 'MED01',
    serviceType: 'convenio',
    bookedAt: new Date(2026, 1, 28, 10, 0),
    scheduledAt: new Date(2026, 2, 2, 8, 0),
    status: 'realizada',
    flags: [],
    ...overrides,
  };
}

const run = (items: IndicatorAppointment[], from: Date | null = null, to: Date | null = null) =>
  computeIndicators(items, doctors, from, to);

describe('taxa de falta (decisão 2)', () => {
  it('reproduz o exemplo do PDF: 10 consultas, 2 faltas, 2 canceladas = 25%', () => {
    const items = [
      ...Array.from({ length: 6 }, () => appt({ status: 'realizada' })),
      ...Array.from({ length: 2 }, () => appt({ status: 'falta' })),
      ...Array.from({ length: 2 }, () => appt({ status: 'cancelada_paciente', scheduledAt: new Date(2026, 2, 2, 9, 0) })),
    ];
    const { summary } = run(items);
    expect(summary.total).toBe(10);
    expect(summary.noShowRate).toBe(0.25);
  });

  it('ignora consultas ainda abertas no cálculo da taxa', () => {
    const { summary } = run([appt({ status: 'falta' }), appt({ status: 'agendada' }), appt({ status: 'confirmada' })]);
    expect(summary.noShowRate).toBe(1);
    expect(summary.scheduled).toBe(2);
  });

  it('devolve null quando não há nada para medir', () => {
    expect(run([]).summary.noShowRate).toBeNull();
  });
});

describe('taxa de horário perdido (decisões 1 e 2)', () => {
  it('conta cancelamento do paciente como perda só quando ninguém ocupou o horário', () => {
    const slotA = new Date(2026, 2, 2, 9, 0);
    const slotB = new Date(2026, 2, 2, 10, 0);
    const items = [
      appt({ status: 'realizada' }),
      appt({ status: 'falta' }),
      appt({ status: 'cancelada_paciente', scheduledAt: slotA }),
      appt({ status: 'realizada', scheduledAt: slotA }),
      appt({ status: 'cancelada_paciente', scheduledAt: slotB }),
    ];
    const { summary } = run(items);
    expect(summary.lostSlots).toBe(2);
    expect(summary.lostSlotRate).toBe(0.4);
  });

  it('não conta cancelamento pela clínica contra o paciente', () => {
    const { summary } = run([appt({ status: 'realizada' }), appt({ status: 'cancelada_clinica' })]);
    expect(summary.lostSlots).toBe(0);
    expect(summary.clinicCancellations).toBe(1);
  });

  it('considera reaproveitado mesmo quando a nova consulta está fora do período filtrado', () => {
    const slot = new Date(2026, 2, 2, 9, 0);
    const items = [appt({ status: 'cancelada_paciente', scheduledAt: slot }), appt({ status: 'realizada', scheduledAt: slot })];
    expect(run(items).summary.lostSlots).toBe(0);
  });
});

describe('filtro de período', () => {
  it('considera só as consultas entre as datas (inclusive)', () => {
    const items = [
      appt({ scheduledAt: new Date(2026, 0, 15, 8, 0), status: 'falta' }),
      appt({ scheduledAt: new Date(2026, 1, 15, 8, 0), status: 'realizada' }),
      appt({ scheduledAt: new Date(2026, 2, 15, 8, 0), status: 'falta' }),
    ];
    const { summary } = run(items, new Date(2026, 1, 1), new Date(2026, 1, 28, 23, 59, 59, 999));
    expect(summary.total).toBe(1);
    expect(summary.noShowRate).toBe(0);
  });
});

describe('recortes', () => {
  it('lista todos os médicos, mesmo sem consultas no período', () => {
    const { byDoctor } = run([appt({ doctorId: 'MED01', status: 'falta' })]);
    expect(byDoctor).toEqual([
      { doctorId: 'MED01', name: 'Dr. Paulo Mendes', specialty: 'Cardiologia', completed: 0, noShows: 1, noShowRate: 1 },
      { doctorId: 'MED02', name: 'Dra. Ana Ribeiro', specialty: 'Dermatologia', completed: 0, noShows: 0, noShowRate: null },
    ]);
  });

  it('separa por antecedência do agendamento', () => {
    const scheduledAt = new Date(2026, 2, 20, 8, 0);
    const items = [
      appt({ scheduledAt, bookedAt: new Date(2026, 2, 18, 17, 0), status: 'realizada' }),
      appt({ scheduledAt, bookedAt: new Date(2026, 2, 13, 9, 0), status: 'falta' }),
      appt({ scheduledAt, bookedAt: new Date(2026, 1, 20, 9, 0), status: 'falta' }),
    ];
    const { byLeadTime } = run(items);
    expect(byLeadTime.map((b) => [b.bucket, b.noShows, b.completed])).toEqual([
      ['0-3 dias', 0, 1],
      ['4-7 dias', 1, 0],
      ['8-14 dias', 0, 0],
      ['15+ dias', 1, 0],
    ]);
  });

  it('separa por dia da semana e turno', () => {
    const items = [
      appt({ scheduledAt: new Date(2026, 2, 2, 8, 0), status: 'falta' }),
      appt({ scheduledAt: new Date(2026, 2, 2, 14, 0), status: 'realizada' }),
    ];
    const { byWeekdayShift } = run(items);
    expect(byWeekdayShift.map((g) => [g.weekday, g.shift, g.noShowRate])).toEqual([
      ['segunda', 'manha', 1],
      ['segunda', 'tarde', 0],
    ]);
  });

  it('identifica a primeira consulta do paciente na clínica (decisão 3)', () => {
    const items = [
      appt({ patientId: 'PAC9000', scheduledAt: new Date(2026, 2, 2, 8, 0), status: 'falta' }),
      appt({ patientId: 'PAC9000', scheduledAt: new Date(2026, 2, 9, 8, 0), status: 'realizada', doctorId: 'MED02' }),
    ];
    const { byFirstVisit } = run(items);
    expect(byFirstVisit).toEqual([
      { group: 'primeira_consulta', completed: 0, noShows: 1, noShowRate: 1 },
      { group: 'recorrente', completed: 1, noShows: 0, noShowRate: 0 },
    ]);
  });

  it('não conta uma consulta cancelada como primeira visita', () => {
    const items = [
      appt({ patientId: 'PAC9001', scheduledAt: new Date(2026, 2, 1, 8, 0), status: 'cancelada_paciente' }),
      appt({ patientId: 'PAC9001', scheduledAt: new Date(2026, 2, 9, 8, 0), status: 'realizada' }),
    ];
    expect(run(items).byFirstVisit[0]).toMatchObject({ completed: 1 });
  });

  it('separa convênio e particular', () => {
    const { byServiceType } = run([appt({ serviceType: 'convenio', status: 'falta' }), appt({ serviceType: 'particular' })]);
    expect(byServiceType.map((s) => [s.serviceType, s.noShowRate])).toEqual([
      ['convenio', 1],
      ['particular', 0],
    ]);
  });

  it('agrupa por mês em ordem cronológica', () => {
    const items = [
      appt({ scheduledAt: new Date(2026, 2, 2, 8, 0) }),
      appt({ scheduledAt: new Date(2026, 0, 5, 8, 0), status: 'falta' }),
    ];
    expect(run(items).byMonth.map((m) => m.month)).toEqual(['2026-01', '2026-03']);
  });
});

describe('pacientes reincidentes (decisão 5)', () => {
  it('lista quem faltou 3 vezes ou mais no período, do maior para o menor', () => {
    const faltas = (patientId: string, n: number) =>
      Array.from({ length: n }, (_, i) =>
        appt({ patientId, patientName: patientId, status: 'falta', scheduledAt: new Date(2026, 2, 2 + i, 8, 0) }),
      );
    const items = [...faltas('PAC0100', 2), ...faltas('PAC0200', 4), ...faltas('PAC0300', 3)];
    expect(run(items).repeatNoShowPatients).toEqual([
      { patientId: 'PAC0200', name: 'PAC0200', noShows: 4, appointments: 4 },
      { patientId: 'PAC0300', name: 'PAC0300', noShows: 3, appointments: 3 },
    ]);
  });
});

describe('pendentes de fechamento', () => {
  it('conta as consultas passadas que ninguém fechou', () => {
    const { summary } = run([appt({ status: 'agendada', flags: ['pendente_de_fechamento'] })]);
    expect(summary.pendingClosure).toBe(1);
  });
});