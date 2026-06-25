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
    stun: hitzoneValue,
});
export const UpsertHitzoneItemSchema = z.object({
    part: z.string().min(1),
    cut: hitzoneValue,
    blunt: hitzoneValue,
    bullet: hitzoneValue,
    fire: hitzoneValue,
    water: hitzoneValue,
    thunder: hitzoneValue,
    ice: hitzoneValue,
    dragon: hitzoneValue,
    stun: hitzoneValue.default(0),
});
export const UpsertHitzonesSchema = z.array(UpsertHitzoneItemSchema);
//# sourceMappingURL=hitzone.schema.js.map