import { Router, IRouter } from 'express';
import { prisma } from '../lib/prisma';

const router: IRouter = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/', async (_req, res) => {
  let db: 'ok' | 'error' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'error';
  }
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), db });
});

export default router;
