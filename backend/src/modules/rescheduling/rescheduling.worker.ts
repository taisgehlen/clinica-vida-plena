import type { ReschedulingService } from './rescheduling.service.js';

export function startWorker(service: ReschedulingService, intervalMs: number): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await service.tick();
    } catch (err) {
      console.error('Falha na rotina de confirmações e vagas:', err);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, intervalMs);
  return () => clearInterval(timer);
}
