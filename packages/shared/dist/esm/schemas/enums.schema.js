import { z } from 'zod';
export const MHGameSchema = z.enum([
    'MONSTER_HUNTER_WORLD',
    'MONSTER_HUNTER_WORLD_ICEBORNE',
    'MONSTER_HUNTER_RISE',
    'MONSTER_HUNTER_RISE_SUNBREAK',
    'MONSTER_HUNTER_WILDS',
]);
export const MonsterTypeSchema = z.enum([
    'Large',
    'Small',
    'ElderDragon',
    'Apex',
    'Afflicted',
    'Tempered',
    'FlyingWyvern',
    'BruteWyvern',
    'FangedBeast',
    'Temnoceran',
    'BirdWyvern',
    'Construct',
    'DemiElderDragon',
    'Leviathan',
    'Amphibian',
    'Cephalopod',
    'Machine',
]);
export const ElementSchema = z.enum([
    'Fire', 'Water', 'Thunder', 'Ice', 'Dragon',
    'Poison', 'Sleep', 'Paralysis', 'Blast', 'Stun',
]);
export const WeaknessRatingSchema = z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3),
]);
export const DifficultySchema = z.enum(['Beginner', 'Intermediate', 'Advanced']);
export const RankSchema = z.enum(['LowRank', 'HighRank', 'MasterRank']);
export const DropMethodSchema = z.enum([
    'BodyCarve',
    'TailCarve',
    'BreakReward',
    'CaptureReward',
    'QuestReward',
    'ShinyDrop',
    'WoundDrop',
    'PalicoBoomerang',
]);
export const RoleSchema = z.enum(['USER', 'HELPER', 'ADMIN', 'MASTER']);
export const AuditActionSchema = z.enum(['ROLE_CHANGE', 'BAN', 'UNBAN']);
//# sourceMappingURL=enums.schema.js.map