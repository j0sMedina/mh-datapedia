import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { CreateStrategySchema, UpdateStrategySchema } from '@mh-datapedia/shared';
import * as strategyService from '../services/strategy.service';

const router: IRouter = Router();
const IdParamSchema = z.object({ id: z.string() });

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.post('/', authenticate, validate(CreateStrategySchema), wrap(async (req, res) => {
  const strategy = await strategyService.createStrategy(req.user!.id, req.body);
  res.status(201).json({ data: strategy });
}));

router.put(
  '/:id',
  authenticate,
  validate(IdParamSchema, 'params'),
  validate(UpdateStrategySchema),
  wrap(async (req, res) => {
    const strategy = await strategyService.updateStrategy(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body,
    );
    res.json({ data: strategy });
  }),
);

router.delete(
  '/:id',
  authenticate,
  validate(IdParamSchema, 'params'),
  wrap(async (req, res) => {
    await strategyService.deleteStrategy(req.params.id, req.user!.id, req.user!.role);
    res.status(204).send();
  }),
);

export default router;
