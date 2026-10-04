import axios, { type AxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const http = axios.create({ baseURL: API_URL, timeout: 15000 });

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ErrorBody = { error?: { code?: string; message?: string } } | null;

function toApiError(err: unknown): unknown {
  if (axios.isCancel(err)) return err;
  if (!axios.isAxiosError<ErrorBody>(err)) return err;

  if (err.code === 'ECONNABORTED') {
    return new ApiError('O servidor demorou demais para responder. Tente novamente.', 0, 'timeout');
  }
  if (!err.response) {
    return new ApiError('Não foi possível conectar ao servidor. Verifique se a API está rodando.', 0, 'network_error');
  }
  const body = err.response.data;
  return new ApiError(
    body?.error?.message ?? `Erro inesperado do servidor (${err.response.status}).`,
    err.response.status,
    body?.error?.code ?? 'unknown_error',
  );
}

export async function apiGet<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const response = await http.get<T>(path, config);
    return response.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  try {
    const response = await http.post<T>(path, body);
    return response.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  try {
    const response = await http.patch<T>(path, body);
    return response.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
