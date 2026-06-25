"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameAppearanceSchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
exports.GameAppearanceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    monsterId: zod_1.z.string(),
    game: enums_schema_1.MHGameSchema,
    isNew: zod_1.z.boolean(),
});
//# sourceMappingURL=game.schema.js.map