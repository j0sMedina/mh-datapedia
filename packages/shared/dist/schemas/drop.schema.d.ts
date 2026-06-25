import { z } from 'zod';
export declare const MonsterDropSchema: z.ZodObject<{
    id: z.ZodString;
    monsterId: z.ZodString;
    game: z.ZodEnum<["MONSTER_HUNTER_WORLD", "MONSTER_HUNTER_WORLD_ICEBORNE", "MONSTER_HUNTER_RISE", "MONSTER_HUNTER_RISE_SUNBREAK", "MONSTER_HUNTER_WILDS"]>;
    rank: z.ZodEnum<["LowRank", "HighRank", "MasterRank"]>;
    method: z.ZodEnum<["BodyCarve", "TailCarve", "BreakReward", "CaptureReward", "QuestReward", "ShinyDrop", "WoundDrop", "PalicoBoomerang"]>;
    part: z.ZodNullable<z.ZodString>;
    itemName: z.ZodString;
    quantity: z.ZodNumber;
    rate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    monsterId: string;
    part: string | null;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    rank: "LowRank" | "HighRank" | "MasterRank";
    method: "BodyCarve" | "TailCarve" | "BreakReward" | "CaptureReward" | "QuestReward" | "ShinyDrop" | "WoundDrop" | "PalicoBoomerang";
    itemName: string;
    quantity: number;
    rate: number;
}, {
    id: string;
    monsterId: string;
    part: string | null;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    rank: "LowRank" | "HighRank" | "MasterRank";
    method: "BodyCarve" | "TailCarve" | "BreakReward" | "CaptureReward" | "QuestReward" | "ShinyDrop" | "WoundDrop" | "PalicoBoomerang";
    itemName: string;
    quantity: number;
    rate: number;
}>;
export type MonsterDrop = z.infer<typeof MonsterDropSchema>;
//# sourceMappingURL=drop.schema.d.ts.map