export const env = {
  port: Number(process.env.PORT ?? 3000),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/clinica',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};