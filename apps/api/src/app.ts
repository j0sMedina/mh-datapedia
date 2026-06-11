import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { requestId } from './middleware/requestId';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './logger';
import healthRouter from './routes/health.router';
import gamesRouter from './routes/games.router';
import authRouter from './routes/auth.router';
import monstersRouter from './routes/monsters.router';
import usersRouter from './routes/users.router';
import strategiesRouter from './routes/strategies.router';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'MH Datapedia API', version: '1.0.0' },
    servers: [{ url: '/api' }],
  },
  apis: ['./src/routes/*.router.ts'],
});

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestId);
  app.use(generalLimiter);

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api/health', healthRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/monsters', monstersRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/strategies', strategiesRouter);

  app.use(errorHandler);

  return app;
}
