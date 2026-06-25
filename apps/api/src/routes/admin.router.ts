import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { adminLimiter, searchLimiter } from '../middleware/rateLimiter';
import * as adminService from '../services/admin.service';

const router: IRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// MASTER excluded — cannot be set via API
const SetRoleSchema = z.object({ role: z.enum(['USER', 'HELPER', 'ADMIN']) });

const BanSchema = z.discriminatedUnion('banned', [
  z.object({
    banned: z.literal(true),
    reason: z.string().min(10, 'Reason must be at least 10 characters'),
    bannedUntil: z.string().datetime().nullable(),
  }),
  z.object({ banned: z.literal(false) }),
]);

router.get(
  '/users',
  authenticate,
  authorize('HELPER'),
  searchLimiter,
  wrap(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const users = await adminService.listUsers(search);
    res.json({ users });
  }),
);

router.patch(
  '/users/:id/role',
  authenticate,
  authorize('ADMIN'),
  adminLimiter,
  validate(SetRoleSchema),
  wrap(async (req, res) => {
    const user = await adminService.setRole(
      req.params.id,
      req.body.role,
      req.user!.id,
      req.user!.role,
    );
    res.json({ user });
  }),
);

router.patch(
  '/users/:id/ban',
  authenticate,
  authorize('ADMIN'),
  adminLimiter,
  validate(BanSchema),
  wrap(async (req, res) => {
    const { banned } = req.body;
    const user = await adminService.setBanned(
      req.params.id,
      banned,
      req.user!.id,
      req.user!.role,
      banned ? req.body.reason : undefined,
      banned ? req.body.bannedUntil : undefined,
    );
    res.json({ user });
  }),
);

router.get(
  '/audit',
  authenticate,
  authorize('ADMIN'),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || undefined;
    const result = await adminService.listAuditLog(page, limit, search);
    res.json(result);
  }),
);

export default router;
