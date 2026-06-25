import { z } from 'zod';
export declare const StrategySchema: z.ZodObject<{
    id: z.ZodString;
    monsterId: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    difficulty: z.ZodEnum<["Beginner", "Intermediate", "Advanced"]>;
    game: z.ZodEnum<["MONSTER_HUNTER_WORLD", "MONSTER_HUNTER_WORLD_ICEBORNE", "MONSTER_HUNTER_RISE", "MONSTER_HUNTER_RISE_SUNBREAK", "MONSTER_HUNTER_WILDS"]>;
    authorId: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    title: string;
    content: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    authorId: string;
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    title: string;
    content: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    authorId: string;
    createdAt: string;
    updatedAt: string;
}>;
export type Strategy = z.infer<typeof StrategySchema>;
export declare const CreateStrategySchema: z.ZodObject<{
    monsterId: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    difficulty: z.ZodEnum<["Beginner", "Intermediate", "Advanced"]>;
    game: z.ZodEnum<["MONSTER_HUNTER_WORLD", "MONSTER_HUNTER_WORLD_ICEBORNE", "MONSTER_HUNTER_RISE", "MONSTER_HUNTER_RISE_SUNBREAK", "MONSTER_HUNTER_WILDS"]>;
}, "strip", z.ZodTypeAny, {
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    title: string;
    content: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
}, {
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    title: string;
    content: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
}>;
export type CreateStrategy = z.infer<typeof CreateStrategySchema>;
export declare const UpdateStrategySchema: z.ZodObject<Omit<{
    monsterId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodOptional<z.ZodEnum<["Beginner", "Intermediate", "Advanced"]>>;
    game: z.ZodOptional<z.ZodEnum<["MONSTER_HUNTER_WORLD", "MONSTER_HUNTER_WORLD_ICEBORNE", "MONSTER_HUNTER_RISE", "MONSTER_HUNTER_RISE_SUNBREAK", "MONSTER_HUNTER_WILDS"]>>;
}, "monsterId">, "strip", z.ZodTypeAny, {
    game?: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS" | undefined;
    title?: string | undefined;
    content?: string | undefined;
    difficulty?: "Beginner" | "Intermediate" | "Advanced" | undefined;
}, {
    game?: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS" | undefined;
    title?: string | undefined;
    content?: string | undefined;
    difficulty?: "Beginner" | "Intermediate" | "Advanced" | undefined;
}>;
export type UpdateStrategy = z.infer<typeof UpdateStrategySchema>;
//# sourceMappingURL=strategy.schema.d.ts.map