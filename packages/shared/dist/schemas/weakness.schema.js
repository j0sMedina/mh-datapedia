"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertWeaknessesSchema = exports.UpsertWeaknessItemSchema = exports.ElementWeaknessSchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
exports.ElementWeaknessSchema = zod_1.z.object({
    id: zod_1.z.string(),
    monsterId: zod_1.z.string(),
    element: enums_schema_1.ElementSchema,
    rating: enums_schema_1.WeaknessRatingSchema,
    isImmune: zod_1.z.boolean(),
});
exports.UpsertWeaknessItemSchema = zod_1.z.object({
    element: enums_schema_1.ElementSchema,
    rating: enums_schema_1.WeaknessRatingSchema,
    isImmune: zod_1.z.boolean(),
});
exports.UpsertWeaknessesSchema = zod_1.z.array(exports.UpsertWeaknessItemSchema);
//# sourceMappingURL=weakness.schema.js.map