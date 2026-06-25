import { z } from 'zod';
export declare const AilmentSchema: z.ZodObject<{
    id: z.ZodString;
    monsterId: z.ZodString;
    ailment: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    monsterId: string;
    ailment: string;
}, {
    id: string;
    monsterId: string;
    ailment: string;
}>;
export type Ailment = z.infer<typeof AilmentSchema>;
//# sourceMappingURL=ailment.schema.d.ts.map