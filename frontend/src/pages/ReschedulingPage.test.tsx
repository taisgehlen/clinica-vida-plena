import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../api/client';
import type { Conversation, Overview, UpcomingAppointment } from '../api/rescheduling';
import { ReschedulingPage } from './ReschedulingPage';

const overview: Overview = {
  summary: { awaitingConfirmation: 1, noAnswer: 1, confirmed: 0, declined: 1, openVacancies: 1, anticipatedThisMonth: 2, daysGainedThisMonth: 62 },
  vacancies: [
    {
      id: 'V1',
      doctorName: 'Dr. Paulo Mendes',
      scheduledAt: '2026-10-06T14:00:00-03:00',
      status: 'oferecida',
      origin: { kind: 'cancelamento', appointmentId: 'A1', patientName: 'Carlos Lima' },
      pendingOffer: { offerId: 'O1', patientName: 'Ana Souza', expiresAt: '2099-01-01T00:00:00Z' },
      filledBy: null,
      queue: [
        { appointmentId: 'A2', patientName: 'Ana Souza', scheduledAt: '2026-11-19T09:00:00-03:00', bookedAt: '2026-08-31T10:00:00-03:00', gainDays: 44, skip: 'already_offered' },
        { appointmentId: 'A3', patientName: 'Bruno Alves', scheduledAt: '2026-11-19T10:00:00-03:00', bookedAt: '2026-09-14T10:00:00-03:00', gainDays: 44, skip: null },
        { appointmentId: 'A4', patientName: 'Helena Costa', scheduledAt: '2026-11-11T16:00:00-03:00', bookedAt: '2026-09-19T10:00:00-03:00', gainDays: 36, skip: 'no_phone' },
      ],
    },
  ],
  contacts: [
    {
      patientId: 'PAC0010',
      patientName: 'Otávio Barros',
      phone: '(49) 9****-0044',
      needsAttention: true,
      current: { kind: 'confirmation', status: 'sem_resposta', confirmationId: 'C9', reminderSent: true, scheduledAt: '2026-10-04T16:00:00-03:00', doctorName: 'Dra. Ana Ribeiro' },
      timeline: [
        { at: '2026-10-02T09:00:00-03:00', type: 'request_sent' },
        { at: '2026-10-03T16:00:00-03:00', type: 'reminder_sent' },
        { at: '2026-10-04T04:00:00-03:00', type: 'no_answer' },
      ],
    },
    {
      patientId: 'PAC0002',
      patientName: 'Ana Souza',
      phone: '(49) 9****-4321',
      needsAttention: true,
      current: { kind: 'offer', status: 'pendente', offerId: 'O1', expiresAt: '2099-01-01T00:00:00Z', scheduledAt: '2026-10-06T14:00:00-03:00', doctorName: 'Dr. Paulo Mendes' },
      timeline: [{ at: '2026-10-04T12:00:00-03:00', type: 'offer_sent' }],
    },
  ],
};

const upcoming: UpcomingAppointment[] = [
  {
    appointmentId: 'A5',
    patientName: 'Rafael Gomes',
    doctorId: 'MED02',
    doctorName: 'Dra. Ana Ribeiro',
    scheduledAt: '2026-10-06T16:00:00-03:00',
    status: 'agendada',
    leadDays: 28,
    highRisk: true,
    anticipated: false,
    confirmation: { id: 'C5', status: 'pendente', reminderSent: false },
    confirmationRequestDate: null,
  },
  {
    appointmentId: 'A6',
    patientName: 'Elisa Prado',
    doctorId: 'MED02',
    doctorName: 'Dra. Ana Ribeiro',
    scheduledAt: '2026-10-05T09:00:00-03:00',
    status: 'agendada',
    leadDays: 11,
    highRisk: false,
    anticipated: false,
    confirmation: null,
    confirmationRequestDate: null,
  },
];

const conversation: Conversation = {
  patientName: 'Otávio Barros',
  phone: '(49) 9****-0044',
  messages: [
    { id: 'M1', direction: 'out', kind: 'confirmation_request', body: 'Olá, *Otávio*!', sentAt: '2026-10-02T09:00:00-03:00', link: null, replyToken: null, buttons: [] },
    {
      id: 'M2',
      direction: 'out',
      kind: 'confirmation_reminder',
      body: 'Ainda não recebemos a confirmação',
      sentAt: '2026-10-03T16:00:00-03:00',
      link: null,
      replyToken: 'TOKEN123',
      buttons: [
        { label: 'Vou comparecer', answer: 'yes' },
        { label: 'Não poderei ir', answer: 'no' },
      ],
    },
  ],
};

let getSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getSpy = vi.spyOn(http, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/rescheduling/overview') return { data: overview };
    if (url === '/api/rescheduling/upcoming') return { data: upcoming };
    if (url === '/api/doctors') return { data: [{ id: 'MED02', name: 'Dra. Ana Ribeiro', specialty: 'Dermatologia' }] };
    if (url.startsWith('/api/rescheduling/conversations/')) return { data: conversation };
    throw new Error(`URL inesperada: ${url}`);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('ReschedulingPage', () => {
  it('separa a página nas duas tarefas, cada uma com seus números', async () => {
    render(<ReschedulingPage />);
    const confirmation = await screen.findByRole('region', { name: 'Confirmação de presença' });
    const numbers = within(confirmation).getByRole('list', { name: 'Números: Confirmação de presença' });
    expect(within(numbers).getByText('1 sem resposta: ligar')).toBeInTheDocument();
    expect(within(numbers).getByText('viraram vagas ↓')).toBeInTheDocument();

    const anticipation = screen.getByRole('region', { name: 'Antecipação de consultas' });
    expect(within(anticipation).getByText('62')).toBeInTheDocument();
  });

  it('mostra as regras de cada seção só ao clicar em "Como funciona"', async () => {
    render(<ReschedulingPage />);
    const section = await screen.findByRole('region', { name: 'Confirmação de presença' });
    expect(within(section).queryByText('2 dias antes da consulta')).not.toBeInTheDocument();
    const toggle = within(section).getByRole('button', { name: /Como funciona/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(section).getByText('2 dias antes da consulta')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(within(section).queryByText('2 dias antes da consulta')).not.toBeInTheDocument();
  });

  it('resume a vaga com o próximo da fila e mostra a fila completa só quando pedida', async () => {
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Antecipação de consultas' });
    expect(within(card).getByText(/Abriu porque Carlos Lima cancelou/)).toBeInTheDocument();
    expect(within(card).getByText(/Convite com Ana/)).toBeInTheDocument();
    expect(within(card).getByText(/Se Ana não aceitar:/)).toHaveTextContent('Se Ana não aceitar: Bruno Alves (ganha 44 dias)');
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Ver fila (3) →' }));
    const rows = within(card).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('convite enviado');
    expect(rows[1]).toHaveTextContent('1º');
    expect(rows[2]).toHaveTextContent('sem telefone para contato');
  });

  it('destaca quem não respondeu às 2 mensagens com o telefone para ligar', async () => {
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Mensagens enviadas' });
    expect(within(card).getByText('Sem resposta · ligar')).toBeInTheDocument();
    expect(within(card).getAllByText('Confirmação de presença')).toHaveLength(1);
    expect(within(card).getByText('Convite para antecipar')).toBeInTheDocument();
    expect(within(card).getByText(/Ligue para \(49\) 9\*\*\*\*-0044/)).toBeInTheDocument();
    expect(within(card).getByText('2º lembrete enviado')).toBeInTheDocument();
  });

  it('abre em "Precisam de atenção" e registra confirmação por telefone', async () => {
    const postSpy = vi.spyOn(http, 'post').mockResolvedValue({ data: {} });
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Confirmação de presença' });
    expect(await within(card).findByRole('tab', { name: 'Precisam de atenção (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(within(card).getByText('Rafael Gomes')).toBeInTheDocument();
    expect(within(card).queryByText('Elisa Prado')).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Confirmou por telefone: Rafael Gomes' }));
    expect(within(card).getByText('✓ Confirmou presença')).toBeInTheDocument();
    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('/api/rescheduling/confirmations/C5/confirm-by-phone', undefined));
  });

  it('a aba "Todas as consultas" mostra a tabela completa', async () => {
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Confirmação de presença' });
    fireEvent.click(await within(card).findByRole('tab', { name: 'Todas as consultas (2)' }));
    expect(within(card).getByRole('table')).toHaveTextContent('Elisa Prado');
    expect(within(card).getByText('Não precisa')).toBeInTheDocument();
  });

  it('mostra 5 por vez para a lista não crescer demais', async () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ ...upcoming[0]!, appointmentId: `X${i}`, patientName: `Paciente ${i}` }));
    getSpy.mockImplementation(async (url: string) => {
      if (url === '/api/rescheduling/overview') return { data: overview };
      if (url === '/api/rescheduling/upcoming') return { data: many };
      return { data: [] };
    });
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Confirmação de presença' });
    await within(card).findByText('Paciente 0');
    expect(within(card).queryByText('Paciente 5')).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Mostrar mais 5 ↓' }));
    expect(within(card).getByText('Paciente 9')).toBeInTheDocument();
    expect(within(card).queryByText('Paciente 10')).not.toBeInTheDocument();
  });

  it('cancela uma consulta pela recepção, informando quem cancelou', async () => {
    const patchSpy = vi.spyOn(http, 'patch').mockResolvedValue({ data: {} });
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Confirmação de presença' });
    fireEvent.click(await within(card).findByRole('button', { name: 'Cancelar consulta de Rafael Gomes' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancelar consulta' });
    fireEvent.click(within(dialog).getByLabelText('Clínica cancelou'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar consulta' }));
    await waitFor(() => expect(patchSpy).toHaveBeenCalledWith('/api/appointments/A5/status', { status: 'cancelada_clinica' }));
  });

  it('abre a conversa simulada e responde pelo botão do WhatsApp', async () => {
    const postSpy = vi.spyOn(http, 'post').mockResolvedValue({ data: {} });
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Mensagens enviadas' });
    fireEvent.click(within(card).getByRole('button', { name: 'Simular paciente: Otávio Barros' }));
    const drawer = await screen.findByRole('dialog', { name: 'Conversa simulada com Otávio Barros' });
    expect(within(drawer).getByText(/Demonstração: em produção/)).toBeInTheDocument();
    fireEvent.click(await within(drawer).findByRole('button', { name: 'Vou comparecer' }));
    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('/api/patient/confirmations/TOKEN123', { answer: 'yes' }));
  });

  it('filtra os pacientes contatados pelo tipo de mensagem', async () => {
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Mensagens enviadas' });
    fireEvent.click(within(card).getByRole('button', { name: 'Antecipação' }));
    expect(within(card).queryByText('Otávio Barros')).not.toBeInTheDocument();
    expect(within(card).getByText('Ana Souza')).toBeInTheDocument();
  });

  it('recolhe as vagas já resolvidas', async () => {
    const filled = { ...overview.vacancies[0]!, id: 'V2', status: 'preenchida' as const, pendingOffer: null, filledBy: 'Bruno Alves' };
    getSpy.mockImplementation(async (url: string) => {
      if (url === '/api/rescheduling/overview') return { data: { ...overview, vacancies: [filled] } };
      return { data: [] };
    });
    render(<ReschedulingPage />);
    const card = await screen.findByRole('region', { name: 'Antecipação de consultas' });
    expect(within(card).getByText(/Nenhuma vaga esperando resposta/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: '✓ Concluídas (1) — mostrar' }));
    expect(within(card).getByText('✓ Antecipada para Bruno Alves')).toBeInTheDocument();
  });

  it('avisa quando a API está fora do ar', async () => {
    getSpy.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    render(<ReschedulingPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as confirmações e vagas.');
  });
});