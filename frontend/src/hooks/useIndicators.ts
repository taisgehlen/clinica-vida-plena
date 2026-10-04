import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getIndicators, type Indicators, type Period } from '../api/indicators';

type Result = {
  key: string;
  data: Indicators | null;
  error: string | null;
};

export function useIndicators(period: Period) {
  const { from, to } = period;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>({ key: '', data: null, error: null });
  const key = `${from}|${to}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    getIndicators({ from, to }, controller.signal)
      .then((data) => setResult({ key, data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof ApiError ? err.message : 'Erro inesperado ao carregar os indicadores.';
        setResult((previous) => ({ key, data: previous.data, error: message }));
      });
    return () => controller.abort();
  }, [from, to, key]);

  const status: 'loading' | 'success' | 'error' = result.key !== key ? 'loading' : result.error ? 'error' : 'success';

  return {
    status,
    data: result.data,
    error: status === 'loading' ? null : result.error,
    retry: () => setAttempt((n) => n + 1),
  };
}