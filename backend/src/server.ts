import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function main(): Promise<void> {
  await connectDatabase(env.mongoUrl);
  createApp().listen(env.port, () => {
    console.log(`API rodando em http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});