import { describe, expect, it } from 'vitest';
import { createToken, hashToken } from './token.js';

describe('token', () => {
  it('gera tokens diferentes a cada chamada, longos o bastante para não serem adivinhados', () => {
    const a = createToken();
    const b = createToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
  });

  it('guarda só o hash, e o hash é sempre o mesmo para o mesmo token', () => {
    const { token, tokenHash } = createToken();
    expect(tokenHash).not.toContain(token);
    expect(hashToken(token)).toBe(tokenHash);
  });
});
