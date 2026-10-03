import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { appointmentRoutes } from './modules/appointments/appointment.routes.js';
import { AppointmentService } from './modules/appointments/appointment.service.js';
import type { AppointmentRepository } from './modules/appointments/appointment.types.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import type { DoctorRepository } from './modules/doctors/doctor.types.js';

// What the app needs from the outside. server.ts passes the MongoDB versions;
// tests pass in-memory versions and a fixed clock.
export type AppDependencies = {
  appointments: AppointmentRepository;
  doctors: DoctorRepository;
  now?: () => Date;
};

// Builds the Express app without starting it, so tests can use it directly
export function createApp(deps: AppDependencies) {
  const app = express();
  app.use(helmet()); // security HTTP headers
  app.use(cors({ origin: env.corsOrigin })); // only the frontend's address
  app.use(express.json({ limit: '100kb' })); // rejects oversized bodies

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const appointmentService = new AppointmentService(deps.appointments, deps.doctors, deps.now);
  app.use('/api/appointments', appointmentRoutes(appointmentService));
  app.use('/api/doctors', doctorRoutes(deps.doctors));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}