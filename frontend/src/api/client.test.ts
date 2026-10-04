import { AxiosError, AxiosHeaders, CanceledError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, http } from './client';

const serverError = (status: number, data: unknown) =>
  new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse);

afterEach(() => vi.restoreAllMocks());

describe('apiGet', () => {
  it('devolve os dados da resposta', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: { ok: true } });
    await expect(apiGet('/api/health')).resolves.toEqual({ ok: true });
  });

  it('usa a mensagem de erro que o backend mandou', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(serverError(400, { error: { code: 'validation_error', message: 'Dados inválidos' } }));
    await expect(apiGet('/x')).rejects.toEqual(new ApiError('Dados inválidos', 400, 'validation_error'));
  });

  it('explica o erro quando o backend não manda mensagem', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(serverError(502, '<html>Bad Gateway</html>'));
    await expect(apiGet('/x')).rejects.toMatchObject({ message: 'Erro inesperado do servidor (502).', code: 'unknown_error' });
  });

  it('avisa quando o servidor está fora do ar', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    await expect(apiGet('/x')).rejects.toMatchObject({ code: 'network_error' });
  });

  it('avisa quando o servidor demora demais', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new AxiosError('timeout', 'ECONNABORTED'));
    await expect(apiGet('/x')).rejects.toMatchObject({ code: 'timeout' });
  });

  it('não transforma cancelamento em erro', async () => {
    const canceled = new CanceledError();
    vi.spyOn(http, 'get').mockRejectedValue(canceled);
    await expect(apiGet('/x')).rejects.toBe(canceled);
  });
});