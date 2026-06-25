"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginSchema = exports.RegisterSchema = exports.AuthTokensSchema = exports.UserSchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    username: zod_1.z.string(),
    role: enums_schema_1.RoleSchema,
    createdAt: zod_1.z.string(),
});
exports.AuthTokensSchema = zod_1.z.object({
    accessToken: zod_1.z.string(),
    expiresIn: zod_1.z.number(),
});
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
    password: zod_1.z.string().min(8),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
//# sourceMappingURL=auth.schema.js.map