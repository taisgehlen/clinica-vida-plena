import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';

type Result<T> = { requestKey: string; data: T | null; error: string | null };

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, refreshMs?: number) {
  const loadRef = useRef(load);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T>>({ requestKey: '', data: null, error: null });
  const requestKey = `${key}#${version}`;

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current(controller.signal)
      .then((data) => setResult({ requestKey, data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = errorMessage(err, 'Erro inesperado ao carregar os dados.');
        setResult((previous) => ({ requestKey, data: previous.data, error: message }));
      });
    return () => controller.abort();
  }, [requestKey]);

  useEffect(() => {
    if (!refreshMs) return;
    const timer = setInterval(() => setVersion((n) => n + 1), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  const loading = result.requestKey !== requestKey;
  return {
    data: result.data,
    error: loading ? null : result.error,
    loading,
    reload: () => setVersion((n) => n + 1),
  };
}
