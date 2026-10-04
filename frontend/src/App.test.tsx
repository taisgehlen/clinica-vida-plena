import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from './api/client';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('mostra a clínica, o menu e abre na tela de indicadores', async () => {
    vi.spyOn(http, 'get').mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText('Clínica Vida Plena')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toHaveTextContent('Indicadores de falta');
    expect(await screen.findByRole('heading', { level: 1, name: 'Faltas em consultas' }, { timeout: 10_000 })).toBeInTheDocument();
  }, 15_000);

  it('troca para a tela de confirmações e vagas pelo menu', async () => {
    vi.spyOn(http, 'get').mockReturnValue(new Promise(() => {}));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmações e vagas' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Confirmações e vagas' }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmações e vagas' })).toHaveAttribute('aria-current', 'page');
  }, 15_000);

  it('abre a página do paciente quando o endereço é um link de antecipação', async () => {
    vi.spyOn(http, 'get').mockReturnValue(new Promise(() => {}));
    window.history.pushState({}, '', `/antecipar/${'b'.repeat(43)}`);
    render(<App />);
    expect(await screen.findByText('Carregando…', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
    window.history.pushState({}, '', '/');
  }, 15_000);
});