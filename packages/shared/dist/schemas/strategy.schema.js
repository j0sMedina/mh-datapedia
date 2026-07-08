"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewStrategySchema = exports.UpdateStrategySchema = exports.CreateStrategySchema = exports.StrategySchema = exports.StrategyStatusSchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
exports.StrategyStatusSchema = zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED']);
exports.StrategySchema = zod_1.z.object({
    id: zod_1.z.string(),
    monsterId: zod_1.z.string(),
    title: zod_1.z.string(),
    content: zod_1.z.string(),
    difficulty: enums_schema_1.DifficultySchema,
    game: enums_schema_1.MHGameSchema,
    authorId: zod_1.z.string(),
    author: zod_1.z.object({ id: zod_1.z.string(), username: zod_1.z.string() }),
    status: exports.StrategyStatusSchema,
    rejectionReason: zod_1.z.string().nullable(),
    rejectedAt: zod_1.z.string().nullable(),
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
exports.ReviewStrategySchema = zod_1.z.object({
    action: zod_1.z.enum(['approve', 'reject']),
    reason: zod_1.z.string().min(1).optional(),
}).refine((data) => data.action !== 'reject' || !!data.reason, { message: 'Rejection reason is required', path: ['reason'] });
//# sourceMappingURL=strategy.schema.js.map