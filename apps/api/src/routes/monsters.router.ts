import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  MonsterFiltersSchema,
  CreateMonsterSchema,
  UpdateMonsterSchema,
  MHGameSchema,
  RankSchema,
} from '@mh-datapedia/shared';
import * as monsterService from '../services/monster.service';

const router = Router();
const IdParamSchema = z.object({ id: z.string() });
const DropQuerySchema = z.object({
  game: MHGameSchema.optional(),
  rank: RankSchema.optional(),
});

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.get('/', validate(MonsterFiltersSchema, 'query'), wrap(async (req, res) => {
  const result = await monsterService.listMonsters(req.query as any);
  res.json(result);
}));

router.get('/:id', validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  const monster = await monsterService.getMonsterById(req.params.id);
  res.json({ data: monster });
}));

router.get('/:id/hitzones', validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  res.json({ data: await monsterService.getHitzones(req.params.id) });
}));

router.get('/:id/weaknesses', validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  res.json({ data: await monsterService.getWeaknesses(req.params.id) });
}));

router.get('/:id/subspecies', validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  res.json({ data: await monsterService.getSubspecies(req.params.id) });
}));

router.get(
  '/:id/drops',
  validate(IdParamSchema, 'params'),
  validate(DropQuerySchema, 'query'),
  wrap(async (req, res) => {
    const { game, rank } = req.query as any;
    res.json({ data: await monsterService.getDrops(req.params.id, game, rank) });
  }),
);

router.get('/:id/strategies', validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  res.json({ data: await monsterService.getStrategies(req.params.id) });
}));

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(CreateMonsterSchema),
  wrap(async (req, res) => {
    const monster = await monsterService.createMonster(req.body);
    res.status(201).json({ data: monster });
  }),
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(IdParamSchema, 'params'),
  validate(UpdateMonsterSchema),
  wrap(async (req, res) => {
    const monster = await monsterService.updateMonster(req.params.id, req.body);
    res.json({ data: monster });
  }),
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(IdParamSchema, 'params'),
  wrap(async (req, res) => {
    await monsterService.deleteMonster(req.params.id);
    res.status(204).send();
  }),
);

export default router;
