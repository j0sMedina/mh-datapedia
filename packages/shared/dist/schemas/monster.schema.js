"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonsterFiltersSchema = exports.UpdateMonsterSchema = exports.CreateMonsterSchema = exports.MonsterSchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
const weakness_schema_1 = require("./weakness.schema");
const hitzone_schema_1 = require("./hitzone.schema");
const strategy_schema_1 = require("./strategy.schema");
const ailment_schema_1 = require("./ailment.schema");
const drop_schema_1 = require("./drop.schema");
const BaseMonsterSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    type: enums_schema_1.MonsterTypeSchema,
    imageUrl: zod_1.z.string().nullable(),
    iconUrl: zod_1.z.string().nullable(),
    isBoss: zod_1.z.boolean(),
    habitats: zod_1.z.array(zod_1.z.string()),
    weaknesses: zod_1.z.array(weakness_schema_1.ElementWeaknessSchema),
    hitzones: zod_1.z.array(hitzone_schema_1.HitzoneSchema),
    strategies: zod_1.z.array(strategy_schema_1.StrategySchema),
    ailments: zod_1.z.array(ailment_schema_1.AilmentSchema),
    drops: zod_1.z.array(drop_schema_1.MonsterDropSchema),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.MonsterSchema = BaseMonsterSchema.extend({
    subspecies: zod_1.z.lazy(() => zod_1.z.array(exports.MonsterSchema)),
    parentMonster: zod_1.z.lazy(() => exports.MonsterSchema.nullable()),
});
exports.CreateMonsterSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1),
    type: enums_schema_1.MonsterTypeSchema,
    imageUrl: zod_1.z.string().url().nullable().optional(),
    iconUrl: zod_1.z.string().url().nullable().optional(),
    isBoss: zod_1.z.boolean().optional(),
    habitats: zod_1.z.array(zod_1.z.string()).optional(),
    parentId: zod_1.z.string().cuid().nullable().optional(),
});
exports.UpdateMonsterSchema = exports.CreateMonsterSchema.partial();
exports.MonsterFiltersSchema = zod_1.z.object({
    type: enums_schema_1.MonsterTypeSchema.optional(),
    search: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
//# sourceMappingURL=monster.schema.js.map