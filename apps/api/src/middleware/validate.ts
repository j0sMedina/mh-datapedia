import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../lib/errors';

type Target = 'body' | 'params' | 'query';

export class ValidationError extends AppError {
  constructor(public readonly details: unknown) {
    super(422, 'Validation failed', 'VALIDATION_ERROR');
  }
}

export const validate =
  (schema: ZodSchema, target: Target = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(new ValidationError(result.error.flatten()));
    }
    req[target] = result.data;
    next();
  };
