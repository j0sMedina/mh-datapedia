import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

process.on('SIGTERM', async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});
