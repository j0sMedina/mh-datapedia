import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const router = Router();
const MonsterIdParamSchema = z.object({ monsterId: z.string() });

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.get(
  '/me/favorites',
  authenticate,
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        favorites: { include: { gameAppearances: true, weaknesses: true } },
      },
    });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
    res.json({ data: user.favorites });
  }),
);

router.post(
  '/me/favorites/:monsterId',
  authenticate,
  validate(MonsterIdParamSchema, 'params'),
  wrap(async (req, res) => {
    const { monsterId } = req.params;
    const exists = await prisma.monster.findUnique({ where: { id: monsterId }, select: { id: true } });
    if (!exists) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { favorites: { connect: { id: monsterId } } },
    });
    res.json({ message: 'Added to favorites' });
  }),
);

router.delete(
  '/me/favorites/:monsterId',
  authenticate,
  validate(MonsterIdParamSchema, 'params'),
  wrap(async (req, res) => {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { favorites: { disconnect: { id: req.params.monsterId } } },
    });
    res.status(204).send();
  }),
);

export default router;
