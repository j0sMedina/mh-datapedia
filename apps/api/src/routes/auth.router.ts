import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { AppError } from '../lib/errors';
import { RegisterSchema, LoginSchema } from '@mh-datapedia/shared';
import * as authService from '../services/auth.service';

const router: IRouter = Router();
const COOKIE = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post(
  '/register',
  authLimiter,
  validate(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, accessToken, refreshToken, expiresIn } = await authService.register(req.body);
      res.cookie(COOKIE, refreshToken, COOKIE_OPTS);
      res.status(201).json({ user, accessToken, expiresIn });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login',
  authLimiter,
  validate(LoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, accessToken, refreshToken, expiresIn } = await authService.login(req.body);
      res.cookie(COOKIE, refreshToken, COOKIE_OPTS);
      res.json({ user, accessToken, expiresIn });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies[COOKIE] as string | undefined;
    if (!token) throw new AppError(401, 'No refresh token provided', 'UNAUTHORIZED');
    const { accessToken, refreshToken, expiresIn } = await authService.refresh(token);
    res.cookie(COOKIE, refreshToken, COOKIE_OPTS);
    res.json({ accessToken, expiresIn });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies[COOKIE] as string | undefined;
    if (token) await authService.logout(token);
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
