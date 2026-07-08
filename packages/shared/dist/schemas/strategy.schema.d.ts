import { z } from 'zod';
export declare const StrategyStatusSchema: z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>;
export type StrategyStatus = z.infer<typeof StrategyStatusSchema>;
export declare const StrategySchema: z.ZodObject<{
    id: z.ZodString;
    monsterId: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    difficulty: z.ZodEnum<["Beginner", "Intermediate", "Advanced"]>;
    game: z.ZodEnum<["MONSTER_HUNTER_WORLD", "MONSTER_HUNTER_WORLD_ICEBORNE", "MONSTER_HUNTER_RISE", "MONSTER_HUNTER_RISE_SUNBREAK", "MONSTER_HUNTER_WILDS"]>;
    authorId: z.ZodString;
    author: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
    }, {
        id: string;
        username: string;
    }>;
    status: z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "APPROVED" | "REJECTED";
    id: string;
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    title: string;
    content: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    authorId: string;
    author: {
        id: string;
        username: string;
    };
    rejectionReason: string | null;
    rejectedAt: string | null;
    createdAt: string;
    updatedAt: string;
}, {
    status: "PENDING" | "APPROVED" | "REJECTED";
    id: string;
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    title: string;
    content: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    authorId: string;
    author: {
        id: string;
        username: string;
    };
    rejectionReason: string | null;
    rejectedAt: string | null;
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
export declare const ReviewStrategySchema: z.ZodEffects<z.ZodObject<{
    action: z.ZodEnum<["approve", "reject"]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    reason?: string | undefined;
}, {
    action: "approve" | "reject";
    reason?: string | undefined;
}>, {
    action: "approve" | "reject";
    reason?: string | undefined;
}, {
    action: "approve" | "reject";
    reason?: string | undefined;
}>;
export type ReviewStrategy = z.infer<typeof ReviewStrategySchema>;
//# sourceMappingURL=strategy.schema.d.ts.map