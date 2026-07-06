import { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const requireVerified: RequestHandler = async (req, _res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { emailVerified: true },
    });
    if (!user?.emailVerified) {
      return next(new AppError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED'));
    }
    next();
  } catch (err) {
    next(err);
  }
};
