"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertHitzonesSchema = exports.UpsertHitzoneItemSchema = exports.HitzoneSchema = void 0;
const zod_1 = require("zod");
const hitzoneValue = zod_1.z.number().int().min(0).max(100);
exports.HitzoneSchema = zod_1.z.object({
    id: zod_1.z.string(),
    monsterId: zod_1.z.string(),
    part: zod_1.z.string(),
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
exports.UpsertHitzoneItemSchema = zod_1.z.object({
    part: zod_1.z.string().min(1),
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
exports.UpsertHitzonesSchema = zod_1.z.array(exports.UpsertHitzoneItemSchema);
//# sourceMappingURL=hitzone.schema.js.map