import { z } from 'zod';
export declare const ElementWeaknessSchema: z.ZodObject<{
    id: z.ZodString;
    monsterId: z.ZodString;
    element: z.ZodEnum<["Fire", "Water", "Thunder", "Ice", "Dragon", "Poison", "Sleep", "Paralysis", "Blast", "Stun"]>;
    rating: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    isImmune: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    monsterId: string;
    element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
    rating: 0 | 1 | 2 | 3;
    isImmune: boolean;
}, {
    id: string;
    monsterId: string;
    element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
    rating: 0 | 1 | 2 | 3;
    isImmune: boolean;
}>;
export type ElementWeakness = z.infer<typeof ElementWeaknessSchema>;
export declare const UpsertWeaknessItemSchema: z.ZodObject<{
    element: z.ZodEnum<["Fire", "Water", "Thunder", "Ice", "Dragon", "Poison", "Sleep", "Paralysis", "Blast", "Stun"]>;
    rating: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    isImmune: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
    rating: 0 | 1 | 2 | 3;
    isImmune: boolean;
}, {
    element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
    rating: 0 | 1 | 2 | 3;
    isImmune: boolean;
}>;
export declare const UpsertWeaknessesSchema: z.ZodArray<z.ZodObject<{
    element: z.ZodEnum<["Fire", "Water", "Thunder", "Ice", "Dragon", "Poison", "Sleep", "Paralysis", "Blast", "Stun"]>;
    rating: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    isImmune: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
    rating: 0 | 1 | 2 | 3;
    isImmune: boolean;
}, {
    element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
    rating: 0 | 1 | 2 | 3;
    isImmune: boolean;
}>, "many">;
export type UpsertWeaknesses = z.infer<typeof UpsertWeaknessesSchema>;
//# sourceMappingURL=weakness.schema.d.ts.map