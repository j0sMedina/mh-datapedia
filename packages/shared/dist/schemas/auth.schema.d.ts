import { z } from 'zod';
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    username: z.ZodString;
    role: z.ZodEnum<["USER", "HELPER", "ADMIN", "MASTER"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    email: string;
    username: string;
    role: "USER" | "HELPER" | "ADMIN" | "MASTER";
}, {
    id: string;
    createdAt: string;
    email: string;
    username: string;
    role: "USER" | "HELPER" | "ADMIN" | "MASTER";
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
//# sourceMappingURL=auth.schema.d.ts.map