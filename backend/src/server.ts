import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { MongoAppointmentRepository } from './modules/appointments/appointment.mongo-repository.js';
import { MongoDoctorRepository } from './modules/doctors/doctor.mongo-repository.js';

async function main(): Promise<void> {
  await connectDatabase(env.mongoUrl);
  const app = createApp({
    appointments: new MongoAppointmentRepository(),
    doctors: new MongoDoctorRepository(),
  });
  app.listen(env.port, () => {
    console.log(`API rodando em http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});