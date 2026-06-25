"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonsterDropSchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
exports.MonsterDropSchema = zod_1.z.object({
    id: zod_1.z.string(),
    monsterId: zod_1.z.string(),
    game: enums_schema_1.MHGameSchema,
    rank: enums_schema_1.RankSchema,
    method: enums_schema_1.DropMethodSchema,
    part: zod_1.z.string().nullable(),
    itemName: zod_1.z.string(),
    quantity: zod_1.z.number().int().min(1),
    rate: zod_1.z.number().min(0).max(100),
});
//# sourceMappingURL=drop.schema.js.map