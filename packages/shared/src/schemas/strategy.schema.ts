import { z } from 'zod';
import { MHGameSchema, DifficultySchema } from './enums.schema';

export const StrategySchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  title: z.string(),
  content: z.string(),
  difficulty: DifficultySchema,
  game: MHGameSchema,
  authorId: z.string(),
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
