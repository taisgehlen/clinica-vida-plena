import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { appointmentRoutes } from './modules/appointments/appointment.routes.js';
import { AppointmentService } from './modules/appointments/appointment.service.js';
import type { AppointmentRepository } from './modules/appointments/appointment.types.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import { indicatorRoutes } from './modules/indicators/indicators.routes.js';
import type { DoctorRepository } from './modules/doctors/doctor.types.js';

export type AppDependencies = {
  appointments: AppointmentRepository;
  doctors: DoctorRepository;
  now?: () => Date;
};

export function createApp(deps: AppDependencies) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin })); 
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const appointmentService = new AppointmentService(deps.appointments, deps.doctors, deps.now);
  app.use('/api/appointments', appointmentRoutes(appointmentService));
  app.use('/api/doctors', doctorRoutes(deps.doctors));
app.use('/api/indicators', indicatorRoutes(deps.appointments, deps.doctors, deps.now));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}