import { z } from 'zod';

const hitzoneValue = z.number().int().min(0).max(100);

export const HitzoneSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  part: z.string(),
  cut: hitzoneValue,
  blunt: hitzoneValue,
  bullet: hitzoneValue,
  fire: hitzoneValue,
  water: hitzoneValue,
  thunder: hitzoneValue,
  ice: hitzoneValue,
  dragon: hitzoneValue,
});
export type Hitzone = z.infer<typeof HitzoneSchema>;
