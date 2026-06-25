import { z } from 'zod';
export declare const GameAppearanceSchema: z.ZodObject<{
    id: z.ZodString;
    monsterId: z.ZodString;
    game: z.ZodEnum<["MONSTER_HUNTER_WORLD", "MONSTER_HUNTER_WORLD_ICEBORNE", "MONSTER_HUNTER_RISE", "MONSTER_HUNTER_RISE_SUNBREAK", "MONSTER_HUNTER_WILDS"]>;
    isNew: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    isNew: boolean;
}, {
    id: string;
    monsterId: string;
    game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
    isNew: boolean;
}>;
export type GameAppearance = z.infer<typeof GameAppearanceSchema>;
//# sourceMappingURL=game.schema.d.ts.map