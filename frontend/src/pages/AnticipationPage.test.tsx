import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../api/client';
import type { Anticipation } from '../api/rescheduling';
import { AnticipationPage } from './AnticipationPage';

const TOKEN = 'a'.repeat(43);

const pending: Anticipation = {
  status: 'pendente',
  patientFirstName: 'Ana',
  doctorName: 'Dr. Paulo Mendes',
  specialty: 'Cardiologia',
  newScheduledAt: '2026-10-06T14:00:00-03:00',
  currentScheduledAt: '2026-11-19T09:00:00-03:00',
  expiresAt: '2026-10-05T12:20:00-03:00',
  gainDays: 44,
};

const notFound = () =>
  new AxiosError('Not found', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 404,
    data: { error: { code: 'offer_not_found', message: 'Oferta não encontrada' } },
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse);

afterEach(() => vi.restoreAllMocks());

describe('AnticipationPage', () => {
  it('mostra o novo horário, a consulta atual e quantos dias antecipa', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: pending });
    render(<AnticipationPage token={TOKEN} />);
    expect(await screen.findByRole('heading', { name: 'Antecipe sua consulta' })).toBeInTheDocument();
    expect(screen.getByText('terça-feira, 06/10, às 14h')).toBeInTheDocument();
    expect(screen.getByText('quinta-feira, 19/11, às 9h')).toBeInTheDocument();
    expect(screen.getByText('Sua consulta fica 44 dias mais cedo')).toBeInTheDocument();
  });

  it('confirma o novo horário e mostra a confirmação com os botões de agenda', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValueOnce({ data: pending }).mockResolvedValue({ data: { ...pending, status: 'aceita' } });
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { ...pending, status: 'aceita' } });
    render(<AnticipationPage token={TOKEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar novo horário' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/api/patient/offers/${TOKEN}/accept`, undefined));
    expect(await screen.findByRole('heading', { name: 'Consulta antecipada!' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '📅 Salvar no Google Agenda' })).toHaveAttribute('href', expect.stringContaining('calendar.google.com'));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('mantém a consulta atual quando o paciente prefere', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce({ data: pending }).mockResolvedValue({ data: { ...pending, status: 'recusada' } });
    vi.spyOn(http, 'post').mockResolvedValue({ data: {} });
    render(<AnticipationPage token={TOKEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Manter minha consulta atual' }));
    expect(await screen.findByRole('heading', { name: 'Consulta mantida' })).toBeInTheDocument();
  });

  it('avisa quando o prazo terminou', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: { ...pending, status: 'expirada' } });
    render(<AnticipationPage token={TOKEN} />);
    expect(await screen.findByRole('heading', { name: 'Este horário não está mais disponível' })).toBeInTheDocument();
  });

  it('explica quando o link não existe', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(notFound());
    render(<AnticipationPage token={TOKEN} />);
    expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeInTheDocument();
  });
});
