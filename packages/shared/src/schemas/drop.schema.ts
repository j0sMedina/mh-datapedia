import { z } from 'zod';
import { MHGameSchema, RankSchema, DropMethodSchema } from './enums.schema';

export const MonsterDropSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  game: MHGameSchema,
  rank: RankSchema,
  method: DropMethodSchema,
  part: z.string().nullable(),
  itemName: z.string(),
  quantity: z.number().int().min(1),
  rate: z.number().min(0).max(100),
});
export type MonsterDrop = z.infer<typeof MonsterDropSchema>;
