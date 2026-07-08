import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireVerified } from '../middleware/requireVerified';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { strategyLimiter } from '../middleware/rateLimiter';
import { CreateStrategySchema, UpdateStrategySchema, ReviewStrategySchema } from '@mh-datapedia/shared';
import * as strategyService from '../services/strategy.service';

const router: IRouter = Router();
const IdParamSchema = z.object({ id: z.string() });

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.post('/', authenticate, requireVerified, strategyLimiter, validate(CreateStrategySchema), wrap(async (req, res) => {
  const strategy = await strategyService.createStrategy(req.user!.id, req.body);
  res.status(201).json({ data: strategy });
}));

router.put(
  '/:id',
  authenticate,
  requireVerified,
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
  requireVerified,
  validate(IdParamSchema, 'params'),
  wrap(async (req, res) => {
    await strategyService.deleteStrategy(req.params.id, req.user!.id, req.user!.role);
    res.status(204).send();
  }),
);

router.get('/pending', authenticate, authorize('HELPER'), wrap(async (req, res) => {
  res.json({ data: await strategyService.getPendingStrategies() });
}));

router.patch(
  '/:id/review',
  authenticate,
  authorize('HELPER'),
  validate(IdParamSchema, 'params'),
  validate(ReviewStrategySchema),
  wrap(async (req, res) => {
    const strategy = await strategyService.reviewStrategy(
      req.params.id,
      req.body.action,
      req.body.reason,
    );
    res.json({ data: strategy });
  }),
);

export default router;
