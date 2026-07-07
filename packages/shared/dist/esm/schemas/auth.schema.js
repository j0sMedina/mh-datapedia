import { z } from 'zod';
import { RoleSchema } from './enums.schema';
export const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    username: z.string(),
    role: RoleSchema,
    emailVerified: z.boolean(),
    createdAt: z.string(),
});
export const AuthTokensSchema = z.object({
    accessToken: z.string(),
    expiresIn: z.number(),
});
export const RegisterSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
    password: z.string().min(8),
});
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
export const ForgotPasswordSchema = z.object({ email: z.string().email() });
export const ResetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
});
export const SessionSchema = z.object({
    id: z.string(),
    deviceLabel: z.string(),
    ipAddress: z.string().nullable(),
    createdAt: z.string(),
    lastUsedAt: z.string(),
    isCurrent: z.boolean(),
});
//# sourceMappingURL=auth.schema.js.map