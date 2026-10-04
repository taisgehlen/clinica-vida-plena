import { fireEvent, render, screen, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../api/client';
import type { Indicators } from '../api/indicators';
import { IndicatorsPage } from './IndicatorsPage';

const rate = (completed: number, noShows: number) => ({ completed, noShows, noShowRate: noShows / (completed + noShows) });

const patients = Array.from({ length: 7 }, (_, i) => ({ patientId: `PAC00${i}`, name: `Paciente ${i}`, noShows: 10 - i, appointments: 12 }));

const indicators: Indicators = {
  period: { from: null, to: null },
  summary: { ...rate(69, 31), total: 110, patientCancellations: 8, clinicCancellations: 2, lostSlots: 35, lostSlotRate: 0.324, cancellationRate: 0.091, pendingClosure: 3, scheduled: 0 },
  byDoctor: [
    { doctorId: 'MED01', name: 'Dr. Paulo Mendes', specialty: 'Cardiologia', ...rate(60, 40) },
    { doctorId: 'MED02', name: 'Dra. Ana Ribeiro', specialty: 'Dermatologia', ...rate(80, 20) },
  ],
  byLeadTime: [
    { bucket: '0-3 dias', ...rate(90, 10) },
    { bucket: '15+ dias', ...rate(60, 40) },
  ],
  byWeekdayShift: [
    { weekday: 'segunda', shift: 'manha', ...rate(50, 50) },
    { weekday: 'terca', shift: 'manha', ...rate(70, 30) },
    { weekday: 'sabado', shift: 'tarde', ...rate(3, 3) },
  ],
  byFirstVisit: [
    { group: 'primeira_consulta', ...rate(63, 37) },
    { group: 'recorrente', ...rate(70, 30) },
  ],
  byServiceType: [
    { serviceType: 'convenio', ...rate(68, 32) },
    { serviceType: 'particular', ...rate(69, 31) },
  ],
  byMonth: [{ month: '2026-03', ...rate(69, 31) }],
  repeatNoShowPatients: patients,
  schedule: {
    capacity: 200,
    occupied: 130,
    free: 70,
    occupancyRate: 0.65,
    cancellations: { total: 10, filled: 6, unfilled: 4 },
    byDoctor: [
      { doctorId: 'MED01', capacity: 100, occupied: 77, occupancyRate: 0.77 },
      { doctorId: 'MED02', capacity: 100, occupied: 53, occupancyRate: 0.53 },
    ],
  },
};

const respondWith = (body: unknown) => vi.spyOn(http, 'get').mockResolvedValue({ data: body });

const failWith = (status: number, body: unknown) =>
  vi.spyOn(http, 'get').mockRejectedValue(
    new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status,
      data: body,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse),
  );

afterEach(() => vi.restoreAllMocks());

describe('IndicatorsPage', () => {
  it('mostra a taxa geral, as quantidades da agenda e o aviso de pendentes', async () => {
    respondWith(indicators);
    render(<IndicatorsPage />);
    expect(await screen.findByText('31,0%')).toBeInTheDocument();
    expect(screen.getByText('130')).toBeInTheDocument();
    expect(screen.getByText(/6 preenchidos/)).toBeInTheDocument();
    expect(screen.getByText(/3 consultas que já passaram estão sem status/)).toBeInTheDocument();
  });

  it('responde as perguntas dos destaques com base nos dados', async () => {
    respondWith(indicators);
    render(<IndicatorsPage />);
    const highlights = await screen.findByRole('region', { name: 'Destaques' });
    expect(within(highlights).getByText('A diferença é grande.', { exact: false })).toBeInTheDocument();
    expect(within(highlights).getByText('7 pontos a mais.', { exact: false })).toBeInTheDocument();
    expect(within(highlights).getByText('Praticamente igual.', { exact: false })).toBeInTheDocument();
  });

  it('ordena os médicos pela taxa de falta e marca quem está acima da média', async () => {
    respondWith(indicators);
    render(<IndicatorsPage />);
    const table = await screen.findByRole('region', { name: 'Agenda por médico' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Dr. Paulo Mendes');
    expect(rows[0]).toHaveTextContent('acima da média');
    expect(rows[1]).not.toHaveTextContent('acima da média');
  });

  it('resume a antecedência e mostra as quantidades de faltas', async () => {
    respondWith(indicators);
    render(<IndicatorsPage />);
    const card = await screen.findByRole('region', { name: 'Antecedência do agendamento' });
    expect(within(card).getByText(/falta 4 vezes mais/)).toBeInTheDocument();
    expect(within(card).getByText('15 dias ou mais: 40 em 100, 40 faltas')).toBeInTheDocument();
  });

  it('mostra o mês a mês com a taxa de cada mês', async () => {
    respondWith(indicators);
    render(<IndicatorsPage />);
    const card = await screen.findByRole('region', { name: 'Mês a mês' });
    expect(within(card).getByText('mar/26: 31,0%')).toBeInTheDocument();
  });

  it('esconde a taxa de dia e turno com poucas consultas', async () => {
    respondWith(indicators);
    render(<IndicatorsPage />);
    const grid = await screen.findByRole('region', { name: 'Dia e turno' });
    expect(within(grid).getByText('— poucas consultas para calcular.', { exact: false })).toBeInTheDocument();
    expect(within(grid).queryByText('50%')).toBeInTheDocument();
  });

  it('mostra 5 pacientes e expande a lista completa', async () => {
    respondWith(indicators);
    render(<IndicatorsPage />);
    const card = await screen.findByRole('region', { name: 'Pacientes com 3 faltas ou mais' });
    expect(within(card).getAllByRole('row')).toHaveLength(1 + 5);
    fireEvent.click(within(card).getByRole('button', { name: 'Ver todos os 7 →' }));
    expect(within(card).getAllByRole('row')).toHaveLength(1 + 7);
  });

  it('explica o erro e oferece tentar de novo quando a API falha', async () => {
    failWith(400, { error: { code: 'validation_error', message: 'Dados inválidos: from: data inexistente' } });
    render(<IndicatorsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Dados inválidos: from: data inexistente');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('avisa quando o servidor está fora do ar', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    render(<IndicatorsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor');
  });

  it('avisa quando o período não tem consultas', async () => {
    respondWith({ ...indicators, summary: { ...indicators.summary, total: 0 } });
    render(<IndicatorsPage />);
    expect(await screen.findByText(/Nenhuma consulta neste período/)).toBeInTheDocument();
  });
});