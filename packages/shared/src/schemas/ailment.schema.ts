import { z } from 'zod';

export const AilmentSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  ailment: z.string(),
});
export type Ailment = z.infer<typeof AilmentSchema>;
