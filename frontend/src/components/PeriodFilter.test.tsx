import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetPeriod } from '../utils/period';
import { PeriodFilter } from './PeriodFilter';

describe('presetPeriod', () => {
  it('calcula os últimos 3 meses a partir de hoje', () => {
    expect(presetPeriod(3, new Date(2026, 9, 3))).toEqual({ from: '2026-07-03', to: '2026-10-03' });
  });

  it('devolve período vazio para todo o histórico', () => {
    expect(presetPeriod(null)).toEqual({ from: '', to: '' });
  });
});

describe('PeriodFilter', () => {
  it('aplica o período digitado', () => {
    const onChange = vi.fn();
    render(<PeriodFilter value={{ from: '', to: '' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    expect(onChange).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-03-31' });
  });

  it('bloqueia data inicial depois da final e explica o problema', () => {
    const onChange = vi.fn();
    render(<PeriodFilter value={{ from: '', to: '' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('A data inicial precisa ser anterior');
    expect(screen.getByRole('button', { name: 'Aplicar período' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marca o período pronto escolhido', () => {
    const onChange = vi.fn();
    render(<PeriodFilter value={{ from: '', to: '' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 3 meses' }));
    expect(screen.getByRole('button', { name: 'Últimos 3 meses' })).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('limpa o filtro e volta para todo o histórico', () => {
    const onChange = vi.fn();
    render(<PeriodFilter value={{ from: '', to: '' }} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Limpar filtro' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }));

    expect(onChange).toHaveBeenLastCalledWith({ from: '', to: '' });
    expect(screen.getByLabelText('De')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Todo o histórico' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Limpar filtro' })).not.toBeInTheDocument();
  });
});