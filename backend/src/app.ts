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
import { indicatorRoutes } from './modules/indicators/indicators.routes.js';
import { patientRoutes, receptionRoutes } from './modules/rescheduling/rescheduling.routes.js';
import { ReschedulingService } from './modules/rescheduling/rescheduling.service.js';
import type { ConfirmationRepository, OfferRepository, Outbox, VacancyRepository } from './modules/rescheduling/rescheduling.types.js';
import { ReschedulingViews } from './modules/rescheduling/rescheduling.views.js';

export type ReschedulingStorage = {
  confirmations: ConfirmationRepository;
  vacancies: VacancyRepository;
  offers: OfferRepository;
  outbox: Outbox;
};

export type AppDependencies = {
  appointments: AppointmentRepository;
  doctors: DoctorRepository;
  rescheduling?: ReschedulingStorage;
  now?: () => Date;
  offerTtlMinutes?: number;
  publicUrl?: string;
};

export type Services = {
  appointmentService: AppointmentService;
  rescheduling: ReschedulingService | null;
  views: ReschedulingViews | null;
};

export function createServices(deps: AppDependencies): Services {
  const now = deps.now ?? (() => new Date());
  const appointmentService = new AppointmentService(deps.appointments, deps.doctors, now);
  if (!deps.rescheduling) return { appointmentService, rescheduling: null, views: null };

  const reschedulingDeps = {
    ...deps.rescheduling,
    appointments: deps.appointments,
    doctors: deps.doctors,
    appointmentService,
    now,
    offerTtlMinutes: deps.offerTtlMinutes ?? env.offerTtlMinutes,
    publicUrl: deps.publicUrl ?? env.publicUrl,
  };
  const rescheduling = new ReschedulingService(reschedulingDeps);
  appointmentService.onCancelled((appointment) => rescheduling.handleCancellation(appointment));
  return { appointmentService, rescheduling, views: new ReschedulingViews(reschedulingDeps, rescheduling) };
}

export function createApp(deps: AppDependencies, services: Services = createServices(deps)) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/appointments', appointmentRoutes(services.appointmentService));
  app.use('/api/doctors', doctorRoutes(deps.doctors));
  app.use('/api/indicators', indicatorRoutes(deps.appointments, deps.doctors, deps.now));
  if (services.rescheduling && services.views) {
    app.use('/api/rescheduling', receptionRoutes(services.rescheduling, services.views));
    app.use('/api/patient', patientRoutes(services.rescheduling));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
