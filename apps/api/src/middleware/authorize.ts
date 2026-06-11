import { RequestHandler } from 'express';
import { AppError } from '../lib/errors';

type Role = 'USER' | 'ADMIN';

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    next();
  };
