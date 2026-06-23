import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as adminService from '../services/admin.service';

const router: IRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const RoleSchema = z.object({ role: z.enum(['USER', 'ADMIN']) });
const BanSchema = z.object({ banned: z.boolean() });

router.get(
  '/users',
  authenticate,
  authorize('ADMIN'),
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
  validate(RoleSchema),
  wrap(async (req, res) => {
    const user = await adminService.setRole(req.params.id, req.body.role, req.user!.id);
    res.json({ user });
  }),
);

router.patch(
  '/users/:id/ban',
  authenticate,
  authorize('ADMIN'),
  validate(BanSchema),
  wrap(async (req, res) => {
    const user = await adminService.setBanned(req.params.id, req.body.banned, req.user!.id);
    res.json({ user });
  }),
);

export default router;
