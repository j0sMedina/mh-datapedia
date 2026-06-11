import { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { ValidationError } from './validate';
import { logger } from '../logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error(err.message, { stack: err.stack });

  if (err instanceof ValidationError) {
    return res.status(422).json({ error: err.message, details: err.details, code: err.code });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Resource already exists', code: 'CONFLICT' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    error: isProd ? 'Internal server error' : (err.message as string),
    code: 'INTERNAL_ERROR',
  });
};
