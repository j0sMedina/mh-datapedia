import { z } from 'zod';
declare const BaseMonsterSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    type: z.ZodEnum<["Small", "ElderDragon", "FlyingWyvern", "BruteWyvern", "FangedBeast", "Temnoceran", "BirdWyvern", "Construct", "DemiElderDragon", "Leviathan", "Amphibian", "Cephalopod", "Machine"]>;
    imageUrl: z.ZodNullable<z.ZodString>;
    iconUrl: z.ZodNullable<z.ZodString>;
    isBoss: z.ZodBoolean;
    habitats: z.ZodArray<z.ZodString, "many">;
    tags: z.ZodArray<z.ZodEnum<["Tempered", "ArchTempered", "Apex", "Afflicted"]>, "many">;
    weaknesses: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    hitzones: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        monsterId: z.ZodString;
        part: z.ZodString;
        cut: z.ZodNumber;
        blunt: z.ZodNumber;
        bullet: z.ZodNumber;
        fire: z.ZodNumber;
        water: z.ZodNumber;
        thunder: z.ZodNumber;
        ice: z.ZodNumber;
        dragon: z.ZodNumber;
        stun: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        monsterId: string;
        part: string;
        cut: number;
        blunt: number;
        bullet: number;
        fire: number;
        water: number;
        thunder: number;
        ice: number;
        dragon: number;
        stun: number;
    }, {
        id: string;
        monsterId: string;
        part: string;
        cut: number;
        blunt: number;
        bullet: number;
        fire: number;
        water: number;
        thunder: number;
        ice: number;
        dragon: number;
        stun: number;
    }>, "many">;
    strategies: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    ailments: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    drops: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    description: string;
    imageUrl: string | null;
    iconUrl: string | null;
    isBoss: boolean;
    habitats: string[];
    tags: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[];
    weaknesses: {
        id: string;
        monsterId: string;
        element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
        rating: 0 | 1 | 2 | 3;
        isImmune: boolean;
    }[];
    hitzones: {
        id: string;
        monsterId: string;
        part: string;
        cut: number;
        blunt: number;
        bullet: number;
        fire: number;
        water: number;
        thunder: number;
        ice: number;
        dragon: number;
        stun: number;
    }[];
    strategies: {
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
    }[];
    ailments: {
        id: string;
        monsterId: string;
        ailment: string;
    }[];
    drops: {
        id: string;
        monsterId: string;
        part: string | null;
        game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
        rank: "LowRank" | "HighRank" | "MasterRank";
        method: "BodyCarve" | "TailCarve" | "BreakReward" | "CaptureReward" | "QuestReward" | "ShinyDrop" | "WoundDrop" | "PalicoBoomerang";
        itemName: string;
        quantity: number;
        rate: number;
    }[];
}, {
    type: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    description: string;
    imageUrl: string | null;
    iconUrl: string | null;
    isBoss: boolean;
    habitats: string[];
    tags: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[];
    weaknesses: {
        id: string;
        monsterId: string;
        element: "Fire" | "Water" | "Thunder" | "Ice" | "Dragon" | "Poison" | "Sleep" | "Paralysis" | "Blast" | "Stun";
        rating: 0 | 1 | 2 | 3;
        isImmune: boolean;
    }[];
    hitzones: {
        id: string;
        monsterId: string;
        part: string;
        cut: number;
        blunt: number;
        bullet: number;
        fire: number;
        water: number;
        thunder: number;
        ice: number;
        dragon: number;
        stun: number;
    }[];
    strategies: {
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
    }[];
    ailments: {
        id: string;
        monsterId: string;
        ailment: string;
    }[];
    drops: {
        id: string;
        monsterId: string;
        part: string | null;
        game: "MONSTER_HUNTER_WORLD" | "MONSTER_HUNTER_WORLD_ICEBORNE" | "MONSTER_HUNTER_RISE" | "MONSTER_HUNTER_RISE_SUNBREAK" | "MONSTER_HUNTER_WILDS";
        rank: "LowRank" | "HighRank" | "MasterRank";
        method: "BodyCarve" | "TailCarve" | "BreakReward" | "CaptureReward" | "QuestReward" | "ShinyDrop" | "WoundDrop" | "PalicoBoomerang";
        itemName: string;
        quantity: number;
        rate: number;
    }[];
}>;
export type Monster = z.infer<typeof BaseMonsterSchema> & {
    subspecies: Monster[];
    parentMonster: Monster | null;
};
export declare const MonsterSchema: z.ZodType<Monster>;
export declare const CreateMonsterSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    type: z.ZodEnum<["Small", "ElderDragon", "FlyingWyvern", "BruteWyvern", "FangedBeast", "Temnoceran", "BirdWyvern", "Construct", "DemiElderDragon", "Leviathan", "Amphibian", "Cephalopod", "Machine"]>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    iconUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isBoss: z.ZodOptional<z.ZodBoolean>;
    habitats: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodEnum<["Tempered", "ArchTempered", "Apex", "Afflicted"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine";
    title: string;
    name: string;
    description: string;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}, {
    type: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine";
    title: string;
    name: string;
    description: string;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}>, {
    type: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine";
    title: string;
    name: string;
    description: string;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}, {
    type: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine";
    title: string;
    name: string;
    description: string;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}>;
export type CreateMonster = z.infer<typeof CreateMonsterSchema>;
export declare const UpdateMonsterSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["Small", "ElderDragon", "FlyingWyvern", "BruteWyvern", "FangedBeast", "Temnoceran", "BirdWyvern", "Construct", "DemiElderDragon", "Leviathan", "Amphibian", "Cephalopod", "Machine"]>>;
    imageUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    iconUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    isBoss: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    habitats: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    parentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    tags: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodEnum<["Tempered", "ArchTempered", "Apex", "Afflicted"]>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type?: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine" | undefined;
    title?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}, {
    type?: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine" | undefined;
    title?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}>, {
    type?: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine" | undefined;
    title?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}, {
    type?: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine" | undefined;
    title?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | null | undefined;
    iconUrl?: string | null | undefined;
    isBoss?: boolean | undefined;
    habitats?: string[] | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    parentId?: string | null | undefined;
}>;
export type UpdateMonster = z.infer<typeof UpdateMonsterSchema>;
export declare const MonsterFiltersSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["Small", "ElderDragon", "FlyingWyvern", "BruteWyvern", "FangedBeast", "Temnoceran", "BirdWyvern", "Construct", "DemiElderDragon", "Leviathan", "Amphibian", "Cephalopod", "Machine"]>>;
    tags: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, string[] | undefined, string | undefined>, z.ZodOptional<z.ZodArray<z.ZodEnum<["Tempered", "ArchTempered", "Apex", "Afflicted"]>, "many">>>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    type?: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine" | undefined;
    tags?: ("Tempered" | "ArchTempered" | "Apex" | "Afflicted")[] | undefined;
    search?: string | undefined;
}, {
    type?: "Small" | "ElderDragon" | "FlyingWyvern" | "BruteWyvern" | "FangedBeast" | "Temnoceran" | "BirdWyvern" | "Construct" | "DemiElderDragon" | "Leviathan" | "Amphibian" | "Cephalopod" | "Machine" | undefined;
    tags?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type MonsterFilters = z.infer<typeof MonsterFiltersSchema>;
export {};
//# sourceMappingURL=monster.schema.d.ts.map