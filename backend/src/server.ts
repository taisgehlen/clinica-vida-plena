import { createApp, createServices, type AppDependencies } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { MongoAppointmentRepository } from './modules/appointments/appointment.mongo-repository.js';
import { MongoDoctorRepository } from './modules/doctors/doctor.mongo-repository.js';
import {
  MongoConfirmationRepository,
  MongoOfferRepository,
  MongoOutbox,
  MongoVacancyRepository,
} from './modules/rescheduling/rescheduling.mongo-repository.js';
import { startWorker } from './modules/rescheduling/rescheduling.worker.js';

async function main(): Promise<void> {
  await connectDatabase(env.mongoUrl);
  const deps: AppDependencies = {
    appointments: new MongoAppointmentRepository(),
    doctors: new MongoDoctorRepository(),
    rescheduling: {
      confirmations: new MongoConfirmationRepository(),
      vacancies: new MongoVacancyRepository(),
      offers: new MongoOfferRepository(),
      outbox: new MongoOutbox(),
    },
  };
  const services = createServices(deps);
  const app = createApp(deps, services);
  app.listen(env.port, () => {
    console.log(`API rodando em http://localhost:${env.port}`);
  });
  if (services.rescheduling) startWorker(services.rescheduling, env.workerIntervalMs);
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});
