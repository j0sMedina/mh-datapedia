import { z } from 'zod';
import { MHGameSchema, DifficultySchema } from './enums.schema';

export const StrategyStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type StrategyStatus = z.infer<typeof StrategyStatusSchema>;

export const StrategySchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  title: z.string(),
  content: z.string(),
  difficulty: DifficultySchema,
  game: MHGameSchema,
  authorId: z.string(),
  author: z.object({ id: z.string(), username: z.string() }),
  status: StrategyStatusSchema,
  rejectionReason: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const CreateStrategySchema = z.object({
  monsterId: z.string().cuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  difficulty: DifficultySchema,
  game: MHGameSchema,
});
export type CreateStrategy = z.infer<typeof CreateStrategySchema>;

export const UpdateStrategySchema = CreateStrategySchema.partial().omit({ monsterId: true });
export type UpdateStrategy = z.infer<typeof UpdateStrategySchema>;

export const ReviewStrategySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(1).optional(),
}).refine(
  (data) => data.action !== 'reject' || !!data.reason,
  { message: 'Rejection reason is required', path: ['reason'] },
);
export type ReviewStrategy = z.infer<typeof ReviewStrategySchema>;
