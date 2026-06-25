"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateStrategySchema = exports.CreateStrategySchema = exports.StrategySchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
exports.StrategySchema = zod_1.z.object({
    id: zod_1.z.string(),
    monsterId: zod_1.z.string(),
    title: zod_1.z.string(),
    content: zod_1.z.string(),
    difficulty: enums_schema_1.DifficultySchema,
    game: enums_schema_1.MHGameSchema,
    authorId: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.CreateStrategySchema = zod_1.z.object({
    monsterId: zod_1.z.string().cuid(),
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string().min(1),
    difficulty: enums_schema_1.DifficultySchema,
    game: enums_schema_1.MHGameSchema,
});
exports.UpdateStrategySchema = exports.CreateStrategySchema.partial().omit({ monsterId: true });
//# sourceMappingURL=strategy.schema.js.map