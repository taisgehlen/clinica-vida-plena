import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from './api/client';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('mostra a clínica, o menu e abre na tela de indicadores', () => {
    vi.spyOn(http, 'get').mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText('Clínica Vida Plena')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toHaveTextContent('Indicadores de falta');
    expect(screen.getByRole('heading', { level: 1, name: 'Faltas em consultas' })).toBeInTheDocument();
  });
});