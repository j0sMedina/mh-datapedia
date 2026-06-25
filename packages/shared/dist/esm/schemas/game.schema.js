import { z } from 'zod';
import { MHGameSchema } from './enums.schema';
export const GameAppearanceSchema = z.object({
    id: z.string(),
    monsterId: z.string(),
    game: MHGameSchema,
    isNew: z.boolean(),
});
//# sourceMappingURL=game.schema.js.map