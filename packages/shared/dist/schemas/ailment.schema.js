"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AilmentSchema = void 0;
const zod_1 = require("zod");
exports.AilmentSchema = zod_1.z.object({
    id: zod_1.z.string(),
    monsterId: zod_1.z.string(),
    ailment: zod_1.z.string(),
});
//# sourceMappingURL=ailment.schema.js.map