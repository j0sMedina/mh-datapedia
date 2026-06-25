import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { prisma } from './lib/prisma';

const app = createApp();

async function pruneAuditLog() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.adminAction.deleteMany({ where: { createdAt: { lt: cutoff } } });
  if (count > 0) logger.info(`Pruned ${count} audit log entries older than 90 days`);
}

const server = app.listen(env.PORT, '::', () => {
  logger.info(`API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  pruneAuditLog();
  setInterval(pruneAuditLog, 24 * 60 * 60 * 1000);
});

process.on('SIGTERM', async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});
