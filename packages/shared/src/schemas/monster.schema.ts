import { z } from 'zod';
import { MHGameSchema, MonsterTypeSchema } from './enums.schema';
import { GameAppearanceSchema } from './game.schema';
import { ElementWeaknessSchema } from './weakness.schema';
import { HitzoneSchema } from './hitzone.schema';
import { StrategySchema } from './strategy.schema';
import { AilmentSchema } from './ailment.schema';
import { MonsterDropSchema } from './drop.schema';

const BaseMonsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  type: MonsterTypeSchema,
  firstGame: MHGameSchema,
  firstYear: z.number().int(),
  imageUrl: z.string().nullable(),
  iconUrl: z.string().nullable(),
  isBoss: z.boolean(),
  habitats: z.array(z.string()),
  games: z.array(GameAppearanceSchema),
  weaknesses: z.array(ElementWeaknessSchema),
  hitzones: z.array(HitzoneSchema),
  strategies: z.array(StrategySchema),
  ailments: z.array(AilmentSchema),
  drops: z.array(MonsterDropSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Monster = z.infer<typeof BaseMonsterSchema> & {
  subspecies: Monster[];
  parentMonster: Monster | null;
};

export const MonsterSchema: z.ZodType<Monster> = BaseMonsterSchema.extend({
  subspecies: z.lazy(() => z.array(MonsterSchema)),
  parentMonster: z.lazy(() => MonsterSchema.nullable()),
});

export const CreateMonsterSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  type: MonsterTypeSchema,
  firstGame: MHGameSchema,
  firstYear: z.number().int().min(1900).max(2100),
  imageUrl: z.string().url().nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  isBoss: z.boolean().optional(),
  habitats: z.array(z.string()).optional(),
  parentId: z.string().cuid().nullable().optional(),
});
export type CreateMonster = z.infer<typeof CreateMonsterSchema>;

export const UpdateMonsterSchema = CreateMonsterSchema.partial();
export type UpdateMonster = z.infer<typeof UpdateMonsterSchema>;

export const MonsterFiltersSchema = z.object({
  game: MHGameSchema.optional(),
  type: MonsterTypeSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MonsterFilters = z.infer<typeof MonsterFiltersSchema>;
