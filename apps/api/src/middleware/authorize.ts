import { RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import type { Role } from '@mh-datapedia/shared';

const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  HELPER: 1,
  ADMIN: 2,
  MASTER: 3,
};

export const authorize =
  (minRole: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || ROLE_RANK[req.user.role as Role] < ROLE_RANK[minRole]) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    next();
  };
