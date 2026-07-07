import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { authLimiter, resendLimiter, forgotPasswordLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { AppError } from '../lib/errors';
import {
  RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema,
  ChangePasswordSchema, TotpVerifySchema, TotpEnableSchema, TotpDisableSchema,
} from '@mh-datapedia/shared';
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
      const { user, accessToken, refreshToken, expiresIn } = await authService.register(req.body, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
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
      const result = await authService.login(req.body, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      if ('mfaRequired' in result) {
        return res.json({ mfaRequired: true, mfaPendingToken: result.mfaPendingToken });
      }
      res.cookie(COOKIE, result.refreshToken, COOKIE_OPTS);
      res.json({ user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn });
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

router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    await authService.verifyEmail(token);
    res.json({ message: 'Email verified' });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/resend-verification',
  authenticate,
  resendLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resendVerification(req.user!.id);
      res.json({ message: 'Verification email sent' });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(ForgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.forgotPassword(req.body.email);
      res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/reset-password',
  forgotPasswordLimiter,
  validate(ResetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      res.json({ message: 'Password reset successfully.' });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentToken = req.cookies[COOKIE] as string | undefined;
    const sessions = await authService.getSessions(req.user!.id, currentToken ?? '');
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/sessions/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentToken = req.cookies[COOKIE] as string | undefined;
      const { wasCurrentSession } = await authService.revokeSession(
        req.params.id,
        req.user!.id,
        currentToken ?? '',
      );
      if (wasCurrentSession) {
        res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict' });
      }
      res.json({ message: 'Session revoked.' });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentToken = req.cookies[COOKIE] as string | undefined;
    await authService.revokeOtherSessions(req.user!.id, currentToken ?? '');
    res.json({ message: 'All other sessions revoked.' });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/change-password',
  authenticate,
  authLimiter,
  validate(ChangePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentToken = req.cookies[COOKIE] as string | undefined;
      await authService.changePassword(
        req.user!.id,
        req.body.currentPassword,
        req.body.newPassword,
        currentToken ?? '',
      );
      res.json({ message: 'Password updated.' });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/totp/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.totpSetup(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/totp/enable',
  authenticate,
  authLimiter,
  validate(TotpEnableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.totpEnable(req.user!.id, req.body.code);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/totp/disable',
  authenticate,
  validate(TotpDisableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.totpDisable(req.user!.id, req.body.password);
      res.json({ message: 'Two-factor authentication disabled.' });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/totp/verify',
  authLimiter,
  validate(TotpVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.totpVerify(req.body.mfaPendingToken, req.body.code, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.cookie(COOKIE, result.refreshToken, COOKIE_OPTS);
      res.json({ user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
