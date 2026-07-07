import { z } from 'zod';
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    username: z.ZodString;
    role: z.ZodEnum<["USER", "HELPER", "ADMIN", "MASTER"]>;
    emailVerified: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    email: string;
    username: string;
    role: "USER" | "HELPER" | "ADMIN" | "MASTER";
    emailVerified: boolean;
}, {
    id: string;
    createdAt: string;
    email: string;
    username: string;
    role: "USER" | "HELPER" | "ADMIN" | "MASTER";
    emailVerified: boolean;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const AuthTokensSchema: z.ZodObject<{
    accessToken: z.ZodString;
    expiresIn: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    expiresIn: number;
}, {
    accessToken: string;
    expiresIn: number;
}>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    username: string;
    password: string;
}, {
    email: string;
    username: string;
    password: string;
}>;
export type Register = z.infer<typeof RegisterSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type Login = z.infer<typeof LoginSchema>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export type ForgotPassword = z.infer<typeof ForgotPasswordSchema>;
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
export declare const SessionSchema: z.ZodObject<{
    id: z.ZodString;
    deviceLabel: z.ZodString;
    ipAddress: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    lastUsedAt: z.ZodString;
    isCurrent: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    deviceLabel: string;
    ipAddress: string | null;
    lastUsedAt: string;
    isCurrent: boolean;
}, {
    id: string;
    createdAt: string;
    deviceLabel: string;
    ipAddress: string | null;
    lastUsedAt: string;
    isCurrent: boolean;
}>;
export type Session = z.infer<typeof SessionSchema>;
export declare const ChangePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
//# sourceMappingURL=auth.schema.d.ts.map