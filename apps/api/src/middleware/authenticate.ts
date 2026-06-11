import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

interface JwtPayload {
  sub: string;
  role: 'USER' | 'ADMIN';
  iat: number;
  exp: number;
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or malformed authorization header', 'UNAUTHORIZED'));
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
};
