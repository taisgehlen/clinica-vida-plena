export const env = {
  port: Number(process.env.PORT ?? 3000),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/clinica',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:5173',
  offerTtlMinutes: Number(process.env.OFFER_TTL_MINUTES ?? 120),
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? 60_000),
};
