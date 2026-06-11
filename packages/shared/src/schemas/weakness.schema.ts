import { z } from 'zod';
import { ElementSchema, WeaknessRatingSchema } from './enums.schema';

export const ElementWeaknessSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  element: ElementSchema,
  rating: WeaknessRatingSchema,
  isImmune: z.boolean(),
});
export type ElementWeakness = z.infer<typeof ElementWeaknessSchema>;
