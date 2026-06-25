import { z } from 'zod';
import { RoleSchema } from './enums.schema';
export const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    username: z.string(),
    role: RoleSchema,
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
//# sourceMappingURL=auth.schema.js.map