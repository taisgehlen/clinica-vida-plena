import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}