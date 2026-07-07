"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordSchema = exports.SessionSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.LoginSchema = exports.RegisterSchema = exports.AuthTokensSchema = exports.UserSchema = void 0;
const zod_1 = require("zod");
const enums_schema_1 = require("./enums.schema");
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    username: zod_1.z.string(),
    role: enums_schema_1.RoleSchema,
    emailVerified: zod_1.z.boolean(),
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
exports.ForgotPasswordSchema = zod_1.z.object({ email: zod_1.z.string().email() });
exports.ResetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z.string().min(8),
});
exports.SessionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    deviceLabel: zod_1.z.string(),
    ipAddress: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    lastUsedAt: zod_1.z.string(),
    isCurrent: zod_1.z.boolean(),
});
exports.ChangePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8),
});
//# sourceMappingURL=auth.schema.js.map