import { describe, it, expect } from 'vitest';
import {
  inferReferenceDate,
  processAppointments,
  type Doctor,
  type RawAppointmentRow,
} from './process.js';

const doctors: Doctor[] = [
  {
    id: 'MED01',
    nome: 'Dr. Paulo Mendes',
    especialidade: 'Cardiologia',
    grade: [
      { dia: 'segunda', inicio: '07:00', fim: '12:00' },
      { dia: 'quarta', inicio: '07:00', fim: '12:00' },
    ],
  },
];

const reference = new Date(2026, 8, 24, 18, 0);

function row(overrides: Partial<RawAppointmentRow> = {}): RawAppointmentRow {
  return {
    id: 'AG00001',
    paciente_id: 'PAC0001',
    paciente_nome: 'Maria Silva',
    paciente_telefone: '(53) 96470-3160',
    tipo_atendimento: 'convenio',
    medico_id: 'MED01',
    data_agendamento: '2026-09-01 10:00',
    data_consulta: '2026-09-14 08:00',
    status: 'realizada',
    ...overrides,
  };
}

const run = (rows: RawAppointmentRow[]) => processAppointments(rows, doctors, reference);

describe('processAppointments', () => {
  describe('linha válida', () => {
    it('importa e normaliza os campos', () => {
      const { appointments, report } = run([row()]);
      expect(report.imported).toBe(1);
      expect(appointments[0]).toMatchObject({
        legacyId: 'AG00001',
        patientId: 'PAC0001',
        patientPhone: '53964703160',
        serviceType: 'convenio',
        doctorId: 'MED01',
        status: 'realizada',
        cancelledAt: null,
        flags: [],
      });
      expect(appointments[0]!.scheduledAt).toEqual(new Date(2026, 8, 14, 8, 0));
    });
  });

  describe('duplicados (decisão 4)', () => {
    it('mantém só uma de duas linhas idênticas', () => {
      const { report } = run([row(), row()]);
      expect(report.imported).toBe(1);
      expect(report.discarded.duplicata_exata).toBe(1);
    });

    it('descarta todas as versões quando o mesmo id tem dados diferentes', () => {
      const { report } = run([row({ status: 'realizada' }), row({ status: 'falta' })]);
      expect(report.imported).toBe(0);
      expect(report.discarded.id_conflitante).toBe(2);
    });

    it('trata duplicata exata antes do conflito (3 linhas: 2 iguais + 1 diferente)', () => {
      const { report } = run([row(), row(), row({ status: 'falta' })]);
      expect(report.discarded.duplicata_exata).toBe(1);
      expect(report.discarded.id_conflitante).toBe(2);
    });
  });

  describe('descartes', () => {
    it.each([
      ['status vazio', { status: '' }, 'status_invalido'],
      ['tipo desconhecido', { tipo_atendimento: 'sus' }, 'tipo_invalido'],
      ['data ilegível', { data_consulta: '2026/09/14' }, 'data_invalida'],
      ['médico inexistente', { medico_id: 'MED99' }, 'medico_desconhecido'],
      ['agendamento depois da consulta', { data_agendamento: '2026-09-20 10:00' }, 'agendamento_apos_consulta'],
      ['realizada no futuro', { data_consulta: '2026-10-05 08:00' }, 'status_final_no_futuro'],
    ] as const)('descarta %s', (_name, overrides, reason) => {
      const { report } = run([row(overrides)]);
      expect(report.imported).toBe(0);
      expect(report.discarded[reason]).toBe(1);
      expect(report.details[0]).toEqual({ line: 2, id: 'AG00001', action: 'descartado', reason });
    });

    it('aceita consulta futura com status aberto', () => {
      const { report } = run([row({ data_consulta: '2026-10-05 08:00', status: 'agendada' })]);
      expect(report.imported).toBe(1);
    });
  });

  describe('correções', () => {
    it('conta status, tipo, data brasileira e telefone corrigidos', () => {
      const { report } = run([
        row({
          status: 'REALIZADA',
          tipo_atendimento: 'Convênio',
          data_consulta: '14/09/2026 08:00',
          paciente_telefone: '+55 53 998575311',
        }),
      ]);
      expect(report.corrected).toEqual({
        status_padronizado: 1,
        tipo_padronizado: 1,
        data_formato_brasileiro: 1,
        telefone_padronizado: 1,
      });
    });

    it('remove telefone inválido mas mantém a consulta', () => {
      const { appointments, report } = run([row({ paciente_telefone: '91234' })]);
      expect(appointments[0]!.patientPhone).toBeNull();
      expect(report.corrected.telefone_invalido_removido).toBe(1);
    });

    it('unifica o nome do paciente pela grafia mais frequente', () => {
      const { appointments, report } = run([
        row({ id: 'AG1', data_consulta: '2026-09-14 08:00', paciente_nome: 'Juliana Soares Freitas' }),
        row({ id: 'AG2', data_consulta: '2026-09-14 09:00', paciente_nome: 'Juliana Soares Freitas' }),
        row({ id: 'AG3', data_consulta: '2026-09-14 10:00', paciente_nome: 'Juliana Soares Fretas' }),
      ]);
      expect(appointments.map((a) => a.patientName)).toEqual([
        'Juliana Soares Freitas',
        'Juliana Soares Freitas',
        'Juliana Soares Freitas',
      ]);
      expect(report.corrected.nome_unificado).toBe(1);
    });
  });

  describe('avisos (a linha é mantida)', () => {
    it('marca "cancelado" sem autor como cancelamento assumido do paciente', () => {
      const { appointments, report } = run([row({ status: 'cancelado' })]);
      expect(appointments[0]!.status).toBe('cancelada_paciente');
      expect(appointments[0]!.flags).toContain('cancelamento_assumido_paciente');
      expect(report.warnings.cancelamento_assumido_paciente).toBe(1);
    });

    it('marca consulta fora da grade do médico', () => {
      const { appointments } = run([row({ data_consulta: '2026-09-15 08:00' })]);
      expect(appointments[0]!.flags).toContain('fora_da_grade');
    });

    it('marca consulta passada que ficou aberta como pendente de fechamento', () => {
      const { appointments } = run([row({ status: 'agendada' })]);
      expect(appointments[0]!.flags).toContain('pendente_de_fechamento');
    });

    it('marca duas consultas ativas no mesmo médico e horário', () => {
      const { appointments } = run([
        row({ id: 'AG1', paciente_id: 'PAC1' }),
        row({ id: 'AG2', paciente_id: 'PAC2' }),
      ]);
      expect(appointments.every((a) => a.flags.includes('conflito_de_horario'))).toBe(true);
    });

    it('não considera conflito quando uma das consultas foi cancelada', () => {
      const { appointments } = run([
        row({ id: 'AG1', paciente_id: 'PAC1', status: 'cancelada_paciente' }),
        row({ id: 'AG2', paciente_id: 'PAC2' }),
      ]);
      expect(appointments.some((a) => a.flags.includes('conflito_de_horario'))).toBe(false);
    });
  });

  it('conta o total de linhas e ordena os detalhes pela linha do CSV', () => {
    const { report } = run([row({ id: 'A', status: '' }), row({ id: 'B' }), row({ id: 'C', medico_id: 'X' })]);
    expect(report.totalRows).toBe(3);
    expect(report.details.map((d) => d.line)).toEqual([2, 4]);
  });
});

describe('inferReferenceDate', () => {
  it('usa o último agendamento registrado como data de exportação', () => {
    const date = inferReferenceDate([
      row({ data_agendamento: '2026-09-01 10:00' }),
      row({ data_agendamento: '24/09/2026 17:42' }),
      row({ data_agendamento: 'inválida' }),
    ]);
    expect(date).toEqual(new Date(2026, 8, 24, 17, 42));
  });
});