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

export async function apiGet<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const response = await http.get<T>(path, config);
    return response.data;
  } catch (err) {
    if (axios.isCancel(err)) throw err;
    if (!axios.isAxiosError<ErrorBody>(err)) throw err;

    if (err.code === 'ECONNABORTED') {
      throw new ApiError('O servidor demorou demais para responder. Tente novamente.', 0, 'timeout');
    }
    if (!err.response) {
      throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está rodando.', 0, 'network_error');
    }
    const body = err.response.data;
    throw new ApiError(
      body?.error?.message ?? `Erro inesperado do servidor (${err.response.status}).`,
      err.response.status,
      body?.error?.code ?? 'unknown_error',
    );
  }
}