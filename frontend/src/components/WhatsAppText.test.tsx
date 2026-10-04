import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WhatsAppText } from './WhatsAppText';

describe('WhatsAppText', () => {
  it('mostra *negrito* e quebras de linha como no WhatsApp', () => {
    const { container } = render(<WhatsAppText text={'Olá, *Ana*!\nSua consulta'} />);
    expect(container.querySelector('strong')?.textContent).toBe('Ana');
    expect(container.querySelectorAll('br')).toHaveLength(1);
  });

  it('nunca interpreta HTML vindo da mensagem', () => {
    const { container } = render(<WhatsAppText text={'<img src=x onerror=alert(1)>'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
