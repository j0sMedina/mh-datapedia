import { z } from 'zod';
import { MonsterTypeSchema, MonsterTagSchema, validateTagCombination } from './enums.schema';
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
    imageUrl: z.string().nullable(),
    iconUrl: z.string().nullable(),
    isBoss: z.boolean(),
    habitats: z.array(z.string()),
    tags: z.array(MonsterTagSchema),
    weaknesses: z.array(ElementWeaknessSchema),
    hitzones: z.array(HitzoneSchema),
    strategies: z.array(StrategySchema),
    ailments: z.array(AilmentSchema),
    drops: z.array(MonsterDropSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export const MonsterSchema = BaseMonsterSchema.extend({
    subspecies: z.lazy(() => z.array(MonsterSchema)),
    parentMonster: z.lazy(() => MonsterSchema.nullable()),
});
const tagRefine = (data, ctx) => {
    if (data.tags && !validateTagCombination(data.tags)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tags'],
            message: 'Invalid tag combination. Afflicted must be solo; ArchTempered requires Apex and cannot pair with Tempered.',
        });
    }
};
const CreateMonsterBaseSchema = z.object({
    name: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    type: MonsterTypeSchema,
    imageUrl: z.string().url().nullable().optional(),
    iconUrl: z.string().url().nullable().optional(),
    isBoss: z.boolean().optional(),
    habitats: z.array(z.string()).optional(),
    parentId: z.string().cuid().nullable().optional(),
    tags: z.array(MonsterTagSchema).optional(),
});
export const CreateMonsterSchema = CreateMonsterBaseSchema.superRefine(tagRefine);
export const UpdateMonsterSchema = CreateMonsterBaseSchema.partial().superRefine(tagRefine);
export const MonsterFiltersSchema = z.object({
    type: MonsterTypeSchema.optional(),
    tags: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
//# sourceMappingURL=monster.schema.js.map